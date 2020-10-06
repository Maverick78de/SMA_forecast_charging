/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

var site_id = "XXXX-XXXX-XXXX-XXXX",
    key_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyy",
    hours = 24;

const url = "https://api.solcast.com.au/rooftop_sites/" + site_id +"/forecasts?format=json&api_key="+ key_id; 
//console.log(url)

function requestData() {
 
    const options = {
        url: url,
        method: 'GET'
    };
    
    request(options, (error, response, body) => {
        if(error) return console.log(error);
        if(response.statusCode == 200) {
            let array = JSON.parse(body).forecasts;
            var list = [];
            for(let i = 0; i < array.length; i++) {
                var endtime = Date.parse(array[i].period_end);
                var time = new Date(endtime-1800000);
                var readpwr = array[i].pv_estimate;
                var readpwr90 = array[i].pv_estimate90;
                list[i] = {};
                list[i].time = time/1000;
                list[i].watt = Math.round(readpwr * 1000);
                list[i].watt90 = Math.round(readpwr90 * 1000);
            };
                    
            for(let a = 0; a < (hours*2); a++) {
                let stateBaseName = "electricity.pvforecast." + a + ".";
                let start = new Date((list[a].time)*1000);
                let end = new Date(((list[a].time)*1000)+1800000)
                var options = { hour12: false, hour: '2-digit', minute:'2-digit'};
                let startTime = start.toLocaleTimeString('de-DE', options);
                let endTime = end.toLocaleTimeString('de-DE', options);

                setState(stateBaseName + "startTime", startTime);
                setState(stateBaseName + "endTime", endTime);
                setState(stateBaseName + "power", list[a].watt);
                setState(stateBaseName + "power90", list[a].watt90);
            }
        }
    });
}

function create_datapoints(){
    for(let a = 0; a < (hours*2); a++) {
        let stateBaseName = "electricity.pvforecast." + a + ".";

        createState(stateBaseName + "startTime", "", {
                   read: true,
                    write: true,
                    name: "Uhrzeit",
                    type: "string",
                    def: false
        });     
        createState(stateBaseName + "endTime", "", {
                   read: true,
                    write: true,
                    name: "Uhrzeit",
                    type: "string",
                    def: false
        });
        createState(stateBaseName + "power", 0, {
                    read: true,
                    write: true,
                    name: "Power",
                    type: "number",
                    def: 0
        });
        createState(stateBaseName + "power90", 0, {
                    read: true,
                    write: true,
                    name: "Power",
                    type: "number",
                    def: 0
        });
    }
}

create_datapoints();

// 20 freie API Request pro Tag, daher 1x stündlich Abruf zwischen 4 und 22 Uhr.
schedule("0 4-22 * * *", function () {
    requestData();
});
