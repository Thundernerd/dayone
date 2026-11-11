#!/usr/bin/env bash
_CS_DEFAULT_URL="${_CS_DEFAULT_URL:-https://raw.githubusercontent.com/Thundernerd/dayone/main/deploy/proxmox}"
_cs_boot="${COMMUNITY_SCRIPTS_CORE_DIR:-$(dirname "${BASH_SOURCE[0]}")/../../core}/core/build.func"
source "$_cs_boot" 2>/dev/null || source <(curl -fsSL "${COMMUNITY_SCRIPTS_CORE_URL:-https://raw.githubusercontent.com/community-scripts/core/main}/core/build.func")
# Copyright (c) 2026 Christiaan Bloemendaal
# Source: https://github.com/Thundernerd/dayone
#
# Day One for Proxmox VE, built on the community-scripts.org engine
# (https://github.com/community-scripts/core): the same wizard, LXC defaults,
# console auto-login, MOTD and `update` command as every other community
# script. This file and install/dayone-install.sh form the scripts root;
# _CS_DEFAULT_URL above points the engine at them.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Thundernerd/dayone/main/deploy/proxmox/ct/dayone.sh)"

APP="Day One"
var_tags="${var_tags:-games}"
var_cpu="${var_cpu:-1}"
var_ram="${var_ram:-512}"
var_disk="${var_disk:-4}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_arm64="${var_arm64:-yes}"
var_unprivileged="${var_unprivileged:-1}"

# Day One has no generated header in the engine repo, so header_info falls back
# to this banner. core.func sets the fallback when it loads, hence after the source.
_CS_FALLBACK_HEADER='    ____                ____
   / __ \____ ___  __  / __ \____  ___
  / / / / __ `/ / / / / / / / __ \/ _ \
 / /_/ / /_/ / /_/ / / /_/ / / / /  __/
/_____/\__,_/\__, /  \____/_/ /_/\___/
            /____/
 Upcoming game releases'

header_info "$APP"
variables
color
catch_errors

DAYONE_REPO="Thundernerd/dayone"

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -f /etc/systemd/system/dayone.service || ! -d /opt/dayone ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  if check_for_gh_release "dayone" "$DAYONE_REPO"; then
    msg_info "Stopping Service"
    systemctl stop dayone
    msg_ok "Stopped Service"

    # /opt/dayone only holds the release; the credentials live in /etc/dayone.
    CLEAN_INSTALL=1 fetch_and_deploy_gh_release "dayone" "$DAYONE_REPO" "prebuild" "latest" "/opt/dayone" "dayone-*.tar.gz"

    # Updates Node 26 in place.
    NODE_VERSION="26" setup_nodejs

    msg_info "Starting Service"
    systemctl start dayone
    msg_ok "Started Service"
    msg_ok "Updated successfully!"
  fi
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access it using the following URL:${CL}"
echo -e "${GATEWAY}${BGN}http://${IP}:3000${CL}"
echo -e "${INFO}${YW}Set the Twitch credentials in /etc/dayone/dayone.env (inside the container), then run: systemctl restart dayone${CL}"
