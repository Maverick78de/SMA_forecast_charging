/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

var pvday = 0,
    pvdayold = 0,
    pvdata = "modbus.0.inputRegisters.30535_PVTagesertrag"; /*PV Tagesertrag aus PV-WR*/

function sendData() {
    pvday = getState(pvdata).val;
    if (pvdayold == 0) {
        pvdayold = pvday;
        return;
    }
    if (pvday > 0 && pvdayold > 0){
        var end = new Date().getTime();
        var time = new Date(end).toISOString();
        var value = ((pvday - pvdayold)*12).toFixed(3);
        console.log("avg Pwr: " + value + "kW");
        var list = [];
        list[0] = {};
        list[0].period_end = time;
        list[0].period = "PT5M";
        list[0].total_power = value;
        var json = JSON.stringify(list);
        //console.log(json);
        var mainlist = '{"measurements":' + json + '}';
        // Requiring fs module in which writeFile function is defined. 
        const fs = require('fs');
        // Workaround - HTTP Post über externes Script, FIX-IT!!!!!
        fs.writeFileSync('/tmp/solcast.txt', mainlist)  
        exec('/usr/local/bin/upload_solcast.sh', function(err, stdout, stderr) {
            if (err) {
                console.log(err);
                return;
            };
        });
        pvdayold = pvday;
    };
};

//sendData()   
schedule("*/5 * * * *", function () {
    sendData()   
})
