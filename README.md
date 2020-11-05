# SMA_forecast_charging
SMA prognosebasierte Ladung mit ioBroker 

Mit diesen Scripten soll die prognosebasierte Ladung von SMA Batteriewechselrichtern mittels ioBroker verbessert werden. Grund sind die jahrelang ungelösten Probleme des SMA HomeManagers, vorallem im bereich der fehlerhaften bzw schlechten Prognose. Die Details können hier nachgelesen werden: https://www.photovoltaikforum.com/thread/119955-warum-wird-eingespeist-und-nicht-der-akku-geladen/

Für Hilfe oder Diskussionen rund um das Projekt bitte hier lang: https://www.photovoltaikforum.com/thread/142863-prognosebasierte-ladung-mittels-iobroker/

Zum Einsatz kommen die Prognosen von Solcast (https://solcast.com/), es ist jedoch denkbar auch andere Prognosesysteme zu verwenden. 
Entsprechende Code Anpassungen sollten sich aus dem Quelltext entnehmen lassen.

Zusätzlich ist eine Ladung mit Netzstrom implementiert bei Einsatz dynamischer Strompreise des Anbieters Awattar (https://www.awattar.de/). 
Dies ermöglich Lade- und Entladeregelungen nach Strompreisen, dies ist z.b sinnvoll bei stark negativen Strompreisen. Diese Funktion ist optional.

Diese Scripte berücksichtigen keine Verbraucher in den Planungen! Die Arbeit der Scripte beruhen ausschließlich auf Standort bezogene Prognosen. Daher empfielt es sich die Rückübermittlung der Anlagendaten an Solcast zu nutzen, da hier die Genauigkeiten nach ca 6 Wochen verbessert werden können (Lerneffekt).

