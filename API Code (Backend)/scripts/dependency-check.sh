#!/bin/bash
VERSION="latest"
DATA_DIRECTORY="$HOME/.dependency-check/data"
REPORT_DIRECTORY="/home/ec2-user/clau-api/MAIN-WITH-UI/API Code (Backend)/src/security-reports"

if [ ! -d "$DATA_DIRECTORY" ]; then
  mkdir -p "$DATA_DIRECTORY"
fi

if [ ! -d "$REPORT_DIRECTORY" ]; then
  mkdir -p "$REPORT_DIRECTORY"
fi

docker run --rm   -v $(pwd):/src   -v "$DATA_DIRECTORY":/usr/share/dependency-check/data   -v "$REPORT_DIRECTORY":/report   owasp/dependency-check:$VERSION   --scan /src   --format "JSON"   --out /report/dependency-check-report.json
