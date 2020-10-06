/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

var addprice = 18.52;
const url = "https://api.awattar.de/v1/marketdata"; 


function requestData() {
 
    const options = {
        url: url,
        method: 'GET'
    };
 
    request(options, (error, response, body) => {
        
        if(error) return console.log(error);
 
        if(response.statusCode == 200) {
 
            let array = JSON.parse(body).data;
 
            for(let i = 0; i < array.length; i++) {
                
                let stateBaseName = "electricity.prices." + i + ".";
                
                createState(stateBaseName + "startTime", "", {
                    read: true,
                    write: true,
                    name: "Gultigkeitsbeginn (Uhrzeit)",
                    type: "string",
                    def: false
                });
 
                createState(stateBaseName + "startDate", "", {
                    read: true,
                    write: true,
                    name: "Gultigkeitsbeginn (Datum)",
                    type: "string",
                    def: false
                });
 
                createState(stateBaseName + "endTime", "", {
                    read: true,
                    write: true,
                    name: "Gultigkeitsende (Uhrzeit)",
                    type: "string",
                    def: false
                });
 
                createState(stateBaseName + "price", 0, {
                    read: true,
                    write: true,
                    name: "Preis",
                    type: "number",
                    def: 0
                });
 
                let start = new Date(array[i].start_timestamp);
                var options = { hour12: false, hour: '2-digit', minute:'2-digit'};
                let startTime = start.toLocaleTimeString('de-DE', options);
                let startDate = start.toLocaleDateString('de-DE');
                 
                let end = new Date(array[i].end_timestamp);
                let endTime = end.toLocaleTimeString('de-DE', options);
 
                let mwhprice = array[i].marketprice;
                let price = ( Number(mwhprice) * 1.19 / 10 ) + addprice;
                
                setState(stateBaseName + "startTime", startTime);
                setState(stateBaseName + "startDate", startDate);
                setState(stateBaseName + "endTime", endTime);
                setState(stateBaseName + "price", price);
            };
            array.sort(function (a, b) {
                return a.marketprice - b.marketprice
            });
            var batprice = getState("javascript.0.electricity.prices.batprice").val;
            var minprice = (array[0].marketprice * 1.19 / 10 ) + addprice;
            if ( minprice > batprice ) {
                minprice = batprice;
            }
            var maxprice = (array[array.length - 1].marketprice * 1.19 / 10 ) + addprice;
            var diffprice = maxprice - minprice;
            var redprice = maxprice - (diffprice/2);
            if ( redprice < batprice ) {
                redprice = batprice;
            }
            setState("javascript.0.electricity.prices.redprice", redprice);
        };
    });
}
requestData();
schedule("0 * * * *", function () {
    requestData();
});
