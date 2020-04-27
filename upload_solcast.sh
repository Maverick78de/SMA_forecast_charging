#!/bin/bash
#
#MIT License - see LICENSE.md 
#Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
#
PATH=/usr/local/bin:/usr/bin:/bin

site_id=XXXX-XXXX-XXXX-XXXX
key_id=yyyyyyyyyyyyyyyyyyyyyyyyyyy

curl -X POST "https://api.solcast.com.au/rooftop_sites/${site_id}/measurements?format=json&api_key=${key_id}" -H 'Content-Type: application/json' --data-binary "@/tmp/solcast.txt"
