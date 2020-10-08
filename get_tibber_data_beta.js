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
                array.push(JSON.parse(body).data.viewer.homes[0].currentSubscription.priceInfo.tomorrow)
            let jetzt = new Date();
            
            for(let i = jetzt.getHours(); i < array.length; i++) {
                let a = i-jetzt.getHours()
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
 
                let start = new Date(Date.parse(array[a].startsAt));
                var options = { hour12: false, hour: '2-digit', minute:'2-digit'};
                let startTime = start.toLocaleTimeString('de-DE', options);
                let startDate = start.toLocaleDateString('de-DE');
                 
                let end = new Date(Date.parse(array[a].startsAt)).getTime()+3600000
                let endTime = new Date(end).toLocaleTimeString('de-DE', options);
 
                let mwhprice = array[a].total;
                let price = Number(mwhprice);
                //console.log(startTime + ',' + startDate + ',' + startTime + ',' + endTime + ',' + price )
                
                setState(stateBaseName + "startTime", startTime);
                setState(stateBaseName + "startDate", startDate);
                setState(stateBaseName + "endTime", endTime);
                setState(stateBaseName + "price", price);
                
            };
            array.sort(function (a, b) {
                return a.total - b.total
            });
            
            var batprice = getState("javascript.0.electricity.prices.batprice").val;
            var minprice = array[0].total;
            if ( minprice > batprice ) {
                minprice = batprice;
            }
            var maxprice = array[array.length - 1].total;
            var diffprice = maxprice - minprice;
            var redprice = minprice + (diffprice/3);
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
