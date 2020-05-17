INSTALLATION

1. Vorbereitung
- Auf den PV und Batteriewechselrichter von SMA muss MODBUS TCP aktiviert sein!
- Im SunnyPortal muss die prognosebasierte Ladung deaktiviert werden!

2. ioBroker Installation
(bitte nur Stable Versionen verwenden!)

Einstiegspunkt: https://www.iobroker.net/#de/documentation/

2.1. Adapter Installation ioBroker
- benötigt werden mindestens folgende Adapter: 
  modbus + JavaScript

2.2. Modbus Instanzen einrichten
- es braucht 2 Instanzen von Modbus, 1x für den PV Wechselrichter und 1x für den Batterie Wechselrichter
- Register aus dem Unterordner Register/ am besten importieren! Hat man weniger Arbeit mit den Scripten.
- nähere Angaben zu den benötigten Modbus Registern bitte der jeweiligen Modbus Dokumentation des Gerätes entnehmen,
  die im Ordner gezeigten Register beziehen sich nur auf getestete Typen.

2.3. Javascript Instanz einrichten
- Unter "Zusätzliche NPM-Module" muss "request" eingetragen werden.

3. Solcast Account anlegen
-> https://toolkit.solcast.com.au/
- registrieren mit "My Home PV", in dieser Form hat man 20 API Abfragen pro Tag frei
- Anlage mit entsprechenden Parametern anlegen. Achtung 0° ist Norden! 180° ist Süden!
- Resource ID und Api_key am besten irgendwo abspeichern

4. Scripte
- in dem Javascript Adapter mehrere Javascripte anlegen und benennen und per Copy und Paste aus dem Original übernehmen. 
  Die Awattar Scripte sind optional!
- in den Scripten die dokumentierten Parameter anpassen!

Nach einiger Zeit sollten dann in den Logs die geplanten Ladezeiten auftauchen. Erreicht die Prognose nicht die untere Schwelle 
werden keine Ladezeiten ausgegeben!
