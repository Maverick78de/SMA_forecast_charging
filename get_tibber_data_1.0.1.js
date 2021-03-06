/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

// Get Tibber Data  (Awattar alternative)
const url = 'https://api.tibber.com/v1-beta/gql'
const token = "Bearer d1007ead2dc84a2b82f0de19451c5fb22112f7ae11d19bf2bedb224a003ff74a"

function requestData() {
 
    const options = {
        uri: url,
        method: 'POST',
        body: '{"query": "{ viewer { homes { currentSubscription{ priceInfo{ today{ total startsAt } tomorrow{ total startsAt } } } } } }" }',
        headers: {
            'Authorization': token,
        'Content-Type': 'application/json'
        }
    }
 
    request(options, (error, response, body) => {
        
        if(error) return console.log(error);
 
        if(response.statusCode == 200) {
            let array = JSON.parse(body).data.viewer.homes[0].currentSubscription.priceInfo.today
                array = array.concat(JSON.parse(body).data.viewer.homes[0].currentSubscription.priceInfo.tomorrow)
            var jetzt = new Date(),
            midn = new Date(
                jetzt.getFullYear(),
                jetzt.getMonth(),
                jetzt.getDate(),
                0,0,0),
            diffhr = Math.floor((jetzt.getTime() - midn.getTime())/3600000)
            for(let i = diffhr; i < array.length; i++) {
                let a = i-diffhr
                let stateBaseName = "electricity.prices." + a + ".";
                
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
 
                let start = new Date(Date.parse(array[i].startsAt));
                var options = { hour12: false, hour: '2-digit', minute:'2-digit'};
                let startTime = start.toLocaleTimeString('de-DE', options);
                let startDate = start.toLocaleDateString('de-DE');
                 
                let end = new Date(Date.parse(array[i].startsAt)).getTime()+3600000
                let endTime = new Date(end).toLocaleTimeString('de-DE', options);
 
                let mwhprice = array[i].total;
                let price = Number(mwhprice);
                //console.log(startTime + ',' + startDate + ',' + startTime + ',' + endTime + ',' + price )
                
                setState(stateBaseName + "startTime", startTime);
                setState(stateBaseName + "startDate", startDate);
                setState(stateBaseName + "endTime", endTime);
                setState(stateBaseName + "price", price*100);
                
            };
        };
    });
}
requestData();
schedule("0 * * * *", function () {
    requestData();
});
