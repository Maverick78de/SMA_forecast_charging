/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

var site_id = "XXXX-XXXX-XXXX-XXXX", /*id der anlage*/
    key_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyy", /*API Key*/
    pvdata = "modbus.1.inputRegisters.30535_PVTagesertrag", /*Objekt PV Wechselrichter Tagesertrag*/
    pvday = 0, /*default nicht ändern*/
    pvdayold = 0; /*default nicht ändern*/

const site = "https://api.solcast.com.au/rooftop_sites/" + site_id +"/measurements?format=json&api_key="+ key_id; 
var request = require('request');

function post_data(json_data){
    request.post({
        uri: site,
        headers: {'Content-Type': 'application/json'},
        body: json_data
        }, function (error, response, body) {
           if (error) {console.log(error)}
           //if (!error) {
           //console.log(response)
           //}
        }
    );
};

function sendData() {
    pvday = getState(pvdata).val;
    if (pvdayold == 0) {
        pvdayold = pvday;
        return;
    }
    if (pvday > 0 && pvdayold > 0){
        var end = new Date().getTime();
        var time = new Date(end).toISOString();
        var value = Math.max(((pvday - pvdayold)*12), 0).toFixed(3);
        console.log("avg Pwr: " + value + "kW");
        var list = [];
        list[0] = {};
        list[0].period_end = time;
        list[0].period = "PT5M";
        list[0].total_power = value;
        var json = JSON.stringify(list);
        //console.log(json);
        var json_data = '{"measurements":' + json + '}';
        post_data(json_data);
        pvdayold = pvday;
    };
};

sendData()   
var Interval = setInterval(function () {
  sendData(); /*start processing in interval*/
}, (300000));