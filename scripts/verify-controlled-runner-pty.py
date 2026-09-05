import os
import queue
import sys
import threading
import time


def fixed_email():
    return "operator-runner" + chr(64) + "example.test"


def fixed_probe():
    return "ECHO_RECOVERY_PROBE_1411"


def emit(name, value):
    print(f"{name}={'PASS' if value else 'FAIL'}")


def read_until(transcript, needle, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if needle in "".join(transcript):
            return True
        time.sleep(0.05)
    return False


def run_windows(bash, runner, mode, cwd, environment):
    from winpty import PtyProcess

    stage = "PTY_SPAWN"
    wrapper = (
        '"$2" "$1"; runner_code=$?; '
        'printf "WRAPPER_ECHO_PROBE_READY\\n"; '
        'IFS= read -r echo_probe </dev/tty; '
        'printf "WRAPPER_ECHO_PROBE_RECEIVED\\n"; '
        'exit "$runner_code"'
    )
    shell_command = bash.replace("\\", "/")
    try:
        process = PtyProcess.spawn([bash, "-c", wrapper, "_", runner, shell_command], cwd=cwd, env=environment, dimensions=(30, 120))
        transcript = []

        def reader():
            while process.isalive():
                try:
                    transcript.append(process.read(4096))
                except Exception:
                    break
            try:
                transcript.append(process.read(4096))
            except Exception:
                pass

        thread = threading.Thread(target=reader, daemon=True)
        thread.start()
        stage = "PTY_INPUT_WAIT"
        ready = read_until(transcript, "CONTROLLED_EMAIL_INPUT=READY", 15)
        value = "" if mode == "empty" else ("invalid" if mode == "invalid" else fixed_email())
        if ready:
            stage = "PTY_INPUT_WRITE"
            process.write(value + "\r")
        stage = "PTY_PROBE_WAIT"
        probe_ready = read_until(transcript, "WRAPPER_ECHO_PROBE_READY", 30)
        if probe_ready:
            stage = "PTY_PROBE_WRITE"
            process.write(fixed_probe() + "\r")
        stage = "PTY_WAIT"
        process.wait()
        thread.join(timeout=2)
        return "".join(transcript), process.exitstatus
    except Exception as error:
        raise RuntimeError(stage) from error


def run_posix(bash, runner, mode, cwd, environment):
    import os as posix_os
    import pty
    import select
    import subprocess

    wrapper = (
        '"$2" "$1"; runner_code=$?; '
        'printf "WRAPPER_ECHO_PROBE_READY\\n"; '
        'IFS= read -r echo_probe </dev/tty; '
        'printf "WRAPPER_ECHO_PROBE_RECEIVED\\n"; '
        'exit "$runner_code"'
    )
    master, slave = pty.openpty()
    process = subprocess.Popen([bash, "-c", wrapper, "_", runner, bash], cwd=cwd, env=environment,
                               stdin=slave, stdout=slave, stderr=slave, close_fds=True)
    posix_os.close(slave)
    transcript = bytearray()
    input_sent = False
    probe_sent = False
    deadline = time.time() + 45
    while time.time() < deadline and (process.poll() is None or not probe_sent):
        readable, _, _ = select.select([master], [], [], 0.1)
        if readable:
            try:
                transcript.extend(posix_os.read(master, 4096))
            except OSError:
                break
        text = transcript.decode("utf8", "replace")
        if not input_sent and "CONTROLLED_EMAIL_INPUT=READY" in text:
            value = "" if mode == "empty" else ("invalid" if mode == "invalid" else fixed_email())
            posix_os.write(master, (value + "\n").encode())
            input_sent = True
        if input_sent and not probe_sent and "WRAPPER_ECHO_PROBE_READY" in text:
            posix_os.write(master, (fixed_probe() + "\n").encode())
            probe_sent = True
    process.wait(timeout=5)
    posix_os.close(master)
    return transcript.decode("utf8", "replace"), process.returncode


def main():
    if len(sys.argv) != 5:
        return 2
    bash, runner, mode, cwd = sys.argv[1:]
    environment = dict(os.environ)
    process_ok = True
    error_category = "NONE"
    try:
        if os.name == "nt":
            transcript, code = run_windows(bash, runner, mode, cwd, environment)
        else:
            transcript, code = run_posix(bash, runner, mode, cwd, environment)
    except Exception as error:
        transcript, code = "", 2
        process_ok = False
        error_category = str(error) if str(error).startswith("PTY_") else type(error).__name__.upper()

    hidden = fixed_email() not in transcript
    echo_recovered = fixed_probe() in transcript and "WRAPPER_ECHO_PROBE_RECEIVED" in transcript
    expected_success = mode == "real"
    runner_result = ("PRIVATE_FILE_READY=PASS" in transcript and code == 0) if expected_success else (
        "PRIVATE_FILE_READY=FAIL" in transcript and code != 0
    )
    output_redacted = fixed_email() not in transcript and "inviteCredential" not in transcript and "postgresql://" not in transcript
    emit("PTY_HIDDEN_INPUT", hidden)
    emit("TERMINAL_ECHO_RECOVERY", echo_recovered)
    emit("EMAIL_LEAK_SCAN", output_redacted)
    emit("PTY_PROCESS", process_ok)
    print(f"PTY_ERROR_CATEGORY={error_category}")
    emit("PTY_INPUT_GATE", "CONTROLLED_EMAIL_INPUT=READY" in transcript)
    emit("PTY_PROBE_GATE", "WRAPPER_ECHO_PROBE_READY" in transcript)
    emit("RUNNER_PRECONDITION_GATE", "FAILED_STAGE=PRECONDITION" not in transcript)
    emit("RUNNER_PRIVATE_PREPARE_GATE", "FAILED_STAGE=PRIVATE_OUTPUT_PREPARE" not in transcript)
    emit("RUNNER_LAUNCH_GATE", "No such file" not in transcript and "not found" not in transcript)
    emit("CONTROLLED_RUNNER_RESULT", runner_result)
    emit("INVITE_CREATE", expected_success and runner_result)
    emit("PRIVATE_FILE_READY", expected_success and runner_result)
    overall = hidden and echo_recovered and output_redacted and runner_result
    print(f"EXIT_CODE={0 if overall else 2}")
    return 0 if overall else 2


if __name__ == "__main__":
    raise SystemExit(main())
