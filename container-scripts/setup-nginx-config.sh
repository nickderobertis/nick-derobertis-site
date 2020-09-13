#!/usr/bin/env bash

A_DEF="/etc/nginx/sites-available/default";
B_DEF="/etc/nginx/sites-enabled/default";

if [ -f "$A_DEF" ]; then
    rm $A_DEF;
fi

if [ -f "$B_DEF" ]; then
    rm $B_DEF;
fi


cat << EOF > /etc/nginx/sites-available/default;
server {
    listen 80 default_server;
    server_name _;

    root /front/dist/webapp;

    # Avoid gateway timeouts
    proxy_read_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host:\$server_port;
        proxy_buffering off;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host:\$server_port;
        proxy_buffering off;
    }

    location /healthcheck {
        # TODO [#7]: disable this to have a real health check
        add_header Content-Type text/plain;
        return 200 'OK';
    }

}
EOF

ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/;
