INSTALLATION

1. Vorbereitung
- Auf den PV und Batteriewechselrichter von SMA muss MODBUS TCP aktiviert sein!
- Im SunnyPortal muss die prognosebasierte Ladung deaktiviert werden!

2. ioBroker Installation

Einstiegspunkt: https://www.iobroker.net/#de/documentation/

2.1. Adapter Installation ioBroker
- benötigt werden mindestens folgende Adapter: modbus + JavaScript

2.2. Modbus Instanzen einrichten
- es braucht 2 Instanzen von Modbus, 1x für den PV Wechselrichter und 1x für den Batterie Wechselrichter
-> siehe dazu Screenshots als Beispiele.
- nähere Angaben zu den benötigten Modbus Registern bitte der jeweiligen Modbus Dokumentation des Gerätes entnehmen,
  die gezeigten Register beziehen sich nur auf ein Sunny Island 6.0H-11 und einem STP9.0-20!
- In den Einstellungen der ScriptEngine Instanz muss das Kommando "exec" erlaubt werden.

3. Solcast Account anlegen
-> https://toolkit.solcast.com.au/
- registrieren mit "My Home PV", in dieser Form hat man 20 API Abfragen pro Tag frei
- Anlage mit entsprechenden Parametern anlegen. Achtung 0° ist Norden! 180° ist Süden!
- Resource ID und Api_key am besten irgendwo abspeichern

4. Scripte
- in dem Javascript Adapter mehrere Javascripte anlegen und benennen und per Copy und Paste aus dem Original übernehmen, 
  bis auf upload_solcast.sh. Die Awattar Scripte sind optional!
- in den Scripten die dokumentierten Parameter anpassen!
- Sonderfall "upload_solcast.sh": zur Rückmeldung der Anlagenleistung an Solcast muss aktuell ein curl Aufruf genutzt werden. 
  Daher upload_solcast.sh nach /usr/local/bin/ auf dem ioBroker Rechner kopieren, insofern hier Linux zum Einsatz kommt. 
  Vorher die api_key und key_id eintragen
  Wer das nicht möchte oder kann, braucht keine Daten zu Solcast senden, dies dient nur der Optimierung der Prognose.
  Z.b. per winscp auf den User pi Account und dann per ssh: 
  
  cp upload_solcast.sh /usr/local/bin/
 
  chmod 755 /usr/local/bin/upload_solcast.sh

Nach einiger Zeit sollten dann in den Logs die geplanten Ladezeiten auftauchen. Erreicht die Prognose nicht die untere Schwelle 
werden keine Ladezeiten ausgegeben!
