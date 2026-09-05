#!/usr/bin/env bash
set -u
set -o pipefail
set +x

runner_dir=${0%/*}
create_operator="$runner_dir/create-registration-invite.mjs"
artifact_verifier="$runner_dir/verify-registration-invite-artifact.mjs"
revoke_operator="$runner_dir/revoke-registration-invite.mjs"
runner_helper="$runner_dir/operator/controlled-invite-runner-helper.mjs"
run_dir="${TMPDIR:-/tmp}/oldmike-controlled-invite"
invite_output="$run_dir/invitation.json"
recovery_ledger="$run_dir/recovery-ledger.json"
status_log="$run_dir/operator-status.log"
controlled_email=
ready=0
failed_stage=PRECONDITION

restore_echo() {
  if [ -r /dev/tty ] && command -v stty >/dev/null 2>&1; then
    stty echo </dev/tty >/dev/null 2>&1 || :
  fi
  controlled_email=
  unset controlled_email
}

private_cleanup() {
  if [ -f "$recovery_ledger" ]; then
    node "$revoke_operator" \
      --artifact "$invite_output" \
      --ledger "$recovery_ledger" \
      --operator controlled-invite-runner \
      >/dev/null 2>&1 || :
  fi
  node "$runner_helper" cleanup "$run_dir" >/dev/null 2>&1 || :
}

fail_closed() {
  restore_echo
  private_cleanup
  printf '%s\n' 'INVITE_CREATE=FAIL'
  printf '%s\n' 'ARTIFACT_VERIFY=FAIL'
  printf '%s\n' 'RECOVERY_LEDGER=FAIL'
  printf '%s\n' 'PRIVATE_FILE_READY=FAIL'
  printf '%s\n' "FAILED_STAGE=$failed_stage"
  printf '%s\n' 'EXIT_CODE=2'
  exit 2
}

on_signal() {
  if [ "$ready" -eq 0 ]; then
    fail_closed
  fi
  restore_echo
  exit 2
}

trap on_signal HUP INT TERM

if [ "$#" -ne 0 ] || [ ! -t 0 ] || [ ! -r /dev/tty ]; then
  fail_closed
fi

if [ -z "${DATABASE_URL:-}" ] || [ -z "${BETTER_AUTH_SECRET:-}" ] || [ "${#BETTER_AUTH_SECRET}" -lt 32 ] ||
   [ -z "${BETTER_AUTH_URL:-}" ] || [ ! -f "$create_operator" ] || [ ! -f "$artifact_verifier" ] ||
   [ ! -f "$revoke_operator" ] || [ ! -f "$runner_helper" ]; then
  fail_closed
fi

failed_stage=PRIVATE_OUTPUT_PREPARE
node "$runner_helper" prepare "$run_dir" >/dev/null 2>&1 || fail_closed
failed_stage=CONTROLLED_EMAIL_INPUT
printf '%s\n' 'CONTROLLED_EMAIL_INPUT=READY'
if ! IFS= read -r -s controlled_email </dev/tty; then
  fail_closed
fi
printf '\n' >/dev/tty

case "$controlled_email" in
  ''|*[![:print:]]*|*@*@*|@*|*@|*' '*) fail_closed ;;
esac
case "$controlled_email" in
  *.*@*|*@*.*) : ;;
  *) fail_closed ;;
esac
if [ "${#controlled_email}" -gt 254 ]; then
  fail_closed
fi

failed_stage=OPERATOR_CREATE
if ! printf '%s\n' "$controlled_email" | node "$create_operator" \
  --email-stdin \
  --base-url "$BETTER_AUTH_URL" \
  --ttl-hours 1 \
  --operator controlled-invite-runner \
  --artifact "$invite_output" \
  --ledger "$recovery_ledger" \
  >"$status_log" 2>&1; then
  fail_closed
fi
restore_echo

failed_stage=ARTIFACT_VERIFY
if ! node "$artifact_verifier" \
  --artifact "$invite_output" \
  --expected-origin "$BETTER_AUTH_URL" \
  >>"$status_log" 2>&1; then
  fail_closed
fi

failed_stage=READY_CONTRACT
if ! node "$runner_helper" verify-ready "$run_dir" "$BETTER_AUTH_URL" >/dev/null 2>&1; then
  fail_closed
fi

ready=1
node "$runner_helper" remove-status "$run_dir" >/dev/null 2>&1 || fail_closed
printf '%s\n' 'INVITE_CREATE=PASS'
printf '%s\n' 'ARTIFACT_VERIFY=PASS'
printf '%s\n' 'RECOVERY_LEDGER=PASS'
printf '%s\n' 'ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD'
printf '%s\n' 'PRIVATE_FILE_READY=PASS'
printf '%s\n' 'EXIT_CODE=0'
exit 0
