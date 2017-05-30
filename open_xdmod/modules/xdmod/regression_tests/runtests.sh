#!/bin/sh

set -e

if [ ! -e ../integration_tests/.secrets ];
then
    echo "ERROR missing .secrets file." >&2
    echo >&2
    cat README.md >&2
    false
fi

phpunit `dirname $0`
