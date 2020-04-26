/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

var pvforecast = "javascript.0.Eigene_Variablen.Vis.PVforecast",
    site_id = "XXXX-XXXX-XXXX-XXXX",
    key_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyy";

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
                var starttime = Date.parse(array[i].period_end);
                var time = new Date(starttime);
                var readpwr = array[i].pv_estimate;
                var pwr = Math.round(readpwr * 1000);
                var wert = pwr; 
                list[i] = {};
                list[i].time = time/1000;
                list[i].watt = wert;
            };
            
            // Datenpunkte anlegen
            createState(pvforecast, "", {
                name: pvforecast,
                desc: 'Tabelle der Vorhersagewerte von solcast.com als Json-Objekt',
                type: 'string',
                unit: '',
                role: 'value'
            });
            var json = JSON.stringify(list);
            json = json.replace(/\"([^(\")"]+)\":/g,"$1:");
            var mainlist = "{ 'object': 'list', 'data': " + json + "}";
            setState(pvforecast, json, true);
            
            for(let a = 0; a < 48; a++) {
                
                let stateBaseName = "electricity.pvforecast." + a + ".";
                
                createState(stateBaseName + "startTime", "", {
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
                
                let start = new Date((list[a].time)*1000);
                var options = { hour12: false, hour: '2-digit', minute:'2-digit'};
                let startTime = start.toLocaleTimeString('de-DE', options);
                let power = list[a].watt;
                

                setState(stateBaseName + "startTime", startTime);
                setState(stateBaseName + "power", power);
            }
        }
    });
}

// 20 freie API Request pro Tag, daher 1x stündlich Abruf zwischen 4 und 22 Uhr.
schedule("0 4-22 * * *", function () {
    requestData();
});
