# SMA_forecast_charging
SMA prognosebasierte Ladung mit ioBroker 

Mit diesen Scripten soll die prognosebasierte Ladung von Batteriewechselrichtern mittels ioBroker verbessert werden.
Zum Einsatz kommen Prognose von Solcast (https://solcast.com/), es ist jedoch denkbar auch andere Prognosesysteme zu verwenden. 
Entsprechende Code Anpassungen sollten sich aus dem Quelltext entnehmen lassen.

Zusätzlich ist eine Ladung mit Netzstrom implementiert bei Einsatz dynamischer Strompreise des Anbieters Awattar (https://www.awattar.de/). 
Dies ermöglich Lade- und Entladeregelungen nach Strompreisen, dies ist z.b sinnvoll bei stark negativen Strompreisen.

