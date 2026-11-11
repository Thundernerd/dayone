#!/usr/bin/env bash

# Copyright (c) 2026 Christiaan Bloemendaal
# License: MIT | https://github.com/Thundernerd/dayone/raw/main/LICENSE
# Source: https://github.com/Thundernerd/dayone

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

# Matches .nvmrc; the engine's default is older.
NODE_VERSION="26" setup_nodejs

# The archive holds a single dayone-<version>/ directory, which prebuild strips,
# so the server lands at /opt/dayone/server/index.mjs.
fetch_and_deploy_gh_release "dayone" "Thundernerd/dayone" "prebuild" "latest" "/opt/dayone" "dayone-*.tar.gz"

msg_info "Configuring Day One"
useradd --system --no-create-home --home-dir /opt/dayone --shell /usr/sbin/nologin dayone
install -d -m 0750 -o root -g dayone /etc/dayone
cat <<'EOF' >/etc/dayone/dayone.env
# Twitch app credentials for IGDB: https://dev.twitch.tv/console/apps
# Restart after changes: systemctl restart dayone
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
EOF
chown root:dayone /etc/dayone/dayone.env
chmod 0640 /etc/dayone/dayone.env
msg_ok "Configured Day One"

msg_info "Creating Service"
cat <<'EOF' >/etc/systemd/system/dayone.service
[Unit]
Description=Day One - upcoming game releases
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=dayone
Group=dayone
WorkingDirectory=/opt/dayone
Environment=NODE_ENV=production HOST=0.0.0.0 PORT=3000
EnvironmentFile=-/etc/dayone/dayone.env
ExecStart=/usr/bin/node /opt/dayone/server/index.mjs
Restart=on-failure
RestartSec=10
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl enable -q --now dayone
msg_ok "Created Service"

motd_ssh
customize
cleanup_lxc
