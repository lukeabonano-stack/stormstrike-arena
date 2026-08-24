#!/bin/sh

## Collection of convenience commands to run a basic web app ##
app_name="weapon_strike_arena"

# logging function
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
function log
{
    now=$(date '+%Y-%m-%d %H:%M:%S')
    log_level=$1

    # print red error messages. Default everything else to cyan
    if [ "$log_level" == "error" ]; then
        printf "[$now] ${RED}ERROR${NC} in gacc: ${RED}${*:2}${NC}\n"
    else
        printf "[$now] ${CYAN}INFO${NC} in gacc: ${CYAN}${*:2}${NC}\n"
    fi    
}

# supported commands & expected usage
com_list=("destructive_clean" "start" "stop" "logs")
supported_coms=${com_list[*]/#/| }
usage="Usage: '$ ./app [${supported_coms:1} ]'"

# validate that a command was supplied
command=$1
if [[ -z "$command" ]]; then
    log error "You have not supplied a command. $usage"
    exit 1
fi

# validate that a supported command was supplied

if [[ ! " ${com_list[*]} " =~ " ${command} " ]]; then
    log error "You have supplied an unsupported command '${command}'. $usage"
    exit 1
fi

# execute command
log info "Now processing ${command} command ..."

if [ "${command}" == "destructive_clean" ]; then

    # 1. Stop the container(s) using the following command:
    log info 'docker compose down'
    docker compose down

    # 2. Delete all containers using the following command:
    log info 'docker rm -f $(docker ps -a -q)'
    docker rm -f $(docker ps -a -q)

elif [ "${command}" == "start" ]; then

    log info 'docker compose up -d'
    docker compose up -d

elif [ "${command}" == "stop" ]; then

    log info 'docker compose stop'
    docker compose stop

elif [ "${command}" == "logs" ]; then

    log info "docker compose logs ${app_name}"
    docker compose logs "${app_name}" -f

fi    

exit 0