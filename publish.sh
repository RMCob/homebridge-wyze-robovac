#! /bin/sh
# Stolen from  NorthernMan54/homebridge-tasmota
# Do NOT run via sudo or root!

npm audit

if  npm run lint; then
  if npm run build; then
    git add .
    npm version minor -m "$1" --force
    npm publish --tag --otp XXXXXX latest  ## XXXXXX comes from Authy app
    git commit -m "$1"
    git push "https://github.com/RMCob/homebridge-wyze-robovac.git" master --tags  ### password is GitHub Personal Token
  else
    echo "Not publishing due to build failure"
  fi
else
  echo "Not publishing due to lint failure"
fi
