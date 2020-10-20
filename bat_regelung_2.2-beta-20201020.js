/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/
/*Version 2.2 beta 2020/10/20*/
// Debug
var debug = 1; /*debug ausgabe ein oder aus 1/0 */

// statische Parameter
var update = 15, /*Update interval in sek, 15 ist ein guter Wert*/
    pvpeak = 21610, /*pv anlagenleistung Wp */
    batcap = 25344, /*batterie kapazität in Wh, statisch wegen fehlerhafter Berechnung im SI*/
    surlimit = 70, /*pv einspeise limit in % */
    bat_grenze = 10, /*nutzbare mindestladung der Batterie, nicht absolutwert sondern zzgl unterer entladegrenze des Systems! z.b. 50% Entladetiefe + 10% -> bat_grenze = 10*/
    bat_ziel = 85, /*gewünschtes Ladeziel der Regelung, bei Blei ca 85% da dann die Ladeleistung stark abfällt und keine vernünftige Regelung mehr zulässt. Bei LI sollte es 100 sein*/
    grundlast = 0, /*Grundlast in Watt falls bekannt*/
    wr_eff = 0.958, /* max BatWR Effizienz laut Datenblatt 0.95=95%, 1.0=100% */
    bat_wr_pwr = 0, /* Ladeleistung der Batterie in W, 0=automatik (wird ausgelesen)*/
    ModBusBat = "modbus.2", /*ID der Modbusinstanz im ioBroker für den BatterieWR*/
    SMA_EM = "sma-em.0.1900208590", /*Name der SMA EnergyMeter/HM2 Instanz bei installierten SAM-EM Adapter, leer lassen wenn nicht vorhanden*/
    Javascript = "javascript.0",
    Verbraucher = ["modbus.3.inputRegisters.30013_Pwr-L1","modbus.3.inputRegisters.30015_Pwr-L2","shelly.0.SHSW-PM#F2FDDC#1.Relay0.Power"]; /*starke Verbraucher mit Power in W berücksichtigen, hier kann der Realverbrauch in einem externen Script berechnet werden*/

// ab hier Awattar Bereich
var awattar = 1, /*wird Awattar benutzt (dyn. Strompreis) 0=nein, 1=ja*/
    gridprice = 15.821, /*(netto bezugspreis)*/
    taxprice = gridprice * 0.16, /*Deutscher Sonderweg, Eigenverbrauch wird mit Steuer aus entgangenen Strombezug besteuert.*/
    pvprice = 10.9255,  /*pv preis*/
    start_charge = pvprice + taxprice, /*Eigenverbrauchspreis*/
    vis = 1, /*visualisierung der Strompreise nutzen ? 0=nein, 1=ja*/
    lossfactor = 35, /*System gesamtverlust in %, nur für Awattar Preisberechnung*/
    loadfact = (lossfactor/100)+1,
    stop_discharge = start_charge * loadfact;
// Ende Awattar

// BAT-WR Register Definition, nur bei Bedarf anpassen
var CmpBMSOpMod = ModBusBat + ".holdingRegisters.40236_CmpBMSOpMod",/*Betriebsart des BMS*/
    BatChaMinW = ModBusBat + ".holdingRegisters.40793_BatChaMinW",/*Minimale Batterieladeleistung*/
    BatChaMaxW = ModBusBat + ".holdingRegisters.40795_BatChaMaxW",/*Maximale Batterieladeleistung*/
    BatDsChaMinW = ModBusBat + ".holdingRegisters.40797_BatDschMinW",/*Minimale Batterieentladeleistung*/
    BatDsChaMaxW = ModBusBat + ".holdingRegisters.40799_BatDschMaxW",/*Maximale Batterieentladeleistung*/
    SollAC = ModBusBat + ".holdingRegisters.40801_GridWSpt", /*Sollwert der Netzaustauschleistung*/
    FedInSpntCom = ModBusBat + ".holdingRegisters.40151_FedInSpntCom", /*Wirk- und Blindleistungsregelung über Kommunikation*/
    FedInPwrAtCom = ModBusBat + ".holdingRegisters.40149_FedInPwrAtCom", /*Wirkleistungsvorgabe*/
    BAT_SoC = ModBusBat + ".inputRegisters.30845_BAT_SoC", /*selbserklärend ;) */
    SelfCsmpDmLim = ModBusBat + ".inputRegisters.31009_SelfCsmpDmLim", /*unteres Entladelimit Eigenverbrauchsbereich (Saisonbetrieb)*/
    SelfCsmpBatChaSttMin =  ModBusBat + ".holdingRegisters.40073_SelfCsmpBatChaSttMin", /*unteres Entladelimit Eigenverbrauchsbereich SBS 3.7-10*/
    RemainChrgTime = ModBusBat + ".inputRegisters.31007_RmgChaTm", /*verbleibende Restladezeit für Boost Ladung (nur PB Speicher?)*/
    PowerOut = ModBusBat + ".inputRegisters.30867_TotWOut", /*aktuelle Einspeiseleistung am Netzanschlußpunkt, BatWR*/
    WMaxCha = ModBusBat + ".holdingRegisters.40189_WMaxCha", /*max Ladeleistung BatWR*/
    WMaxDsch = ModBusBat + ".holdingRegisters.40191_WMaxDsch", /*max Entladeleistung BatWR*/
    BatType = ModBusBat + ".holdingRegisters.40035_BatType", /*Abfrage Batterietyp*/
    PowerAC = ModBusBat + ".inputRegisters.30775_PowerAC", /*Power AC*/
    Dev_Type = ModBusBat + ".inputRegisters.30053_DevTypeId", /*Typnummer*/
    Bat_Chrg_Mode = ModBusBat + ".inputRegisters.30853_ActiveChargeMode", /*Aktives Batterieladeverfahren, nur für SI+Blei Akku nötig*/
    bms_def = 2424,
    SpntCom_def = 803,
    lastSpntCom = 0,
    lastmaxchrg = 0,
    lastmaxdischrg = 0
// Awattar + Vis
if (awattar == 1){
  createState(Javascript + ".electricity.prices.batprice", 0, {
                    read: true,
                    write: true,
                    name: "Bat_Preis",
                    type: "number",
                    def: 0
                });
  createState(Javascript + ".electricity.prices.PVprice", 0, {
                    read: true,
                    write: true,
                    name: "PV_Preis",
                    type: "number",
                    def: 0
                });
  setState(Javascript + ".electricity.prices.batprice",stop_discharge, true); /*dient nur für Visualisierung*/
  setState(Javascript + ".electricity.prices.PVprice", start_charge, true); /*dient nur für Visualisierung*/
};
      
// ab hier Programmcode, nichts ändern!
function processing() {
// Start der Parametrierung
  if (SMA_EM != ""){
    PowerOut = SMA_EM + ".psurplus" /*aktuelle Einspeiseleistung am Netzanschlußpunkt, SMA-EM Adapter*/
  }
  var DevType = getState(Dev_Type).val
  if (DevType < 9356 || DevType > 9362) {
    var batlimit = getState(SelfCsmpDmLim).val
  }
  // Sbs 3.7ff
  if (DevType >= 9356 && DevType <= 9362) {
    var batlimit = getState(SelfCsmpBatChaSttMin).val
  }
  if (batlimit < 0 || batlimit > 100){
    console.log("Warnung! Ausgelesenes Entladelimit unplausibel! Setze auf 0%")
    batlimit = 0
  }
  var batsoc = getState(BAT_SoC).val,
      cur_power_out = getState(PowerOut).val,
      batminlimit = batlimit+bat_grenze,
      batwr_pwr = bat_wr_pwr
      if (bat_wr_pwr == 0){
        batwr_pwr = getState(WMaxCha).val
      }
  var maxchrg_def = batwr_pwr,
      maxdischrg_def = getState(WMaxDsch).val,
      PwrAtCom_def = Math.round(batwr_pwr*(1+1-wr_eff)),
      bat = getState(BatType).val,
      power_ac = getState(PowerAC).val*-1,
      pvlimit = (pvpeak / 100 * surlimit),
      pwr_verbrauch = 0,
      /* Default Werte setzen*/
      RmgChaTm = 0,
      bms = bms_def, 
      minchrg = 0,
      maxchrg = maxchrg_def,
      mindischrg = 0,
      maxdischrg = maxdischrg_def,
      GridWSpt = 0,
      SpntCom = SpntCom_def,
      PwrAtCom = PwrAtCom_def,
      awattar_active = 0;
  for (let v = 0; v < Verbraucher.length ; v++) {
    pwr_verbrauch = pwr_verbrauch + getState(Verbraucher[v]).val
  }
  if (debug == 1){console.log("Verbraucher:" + pwr_verbrauch.toFixed(0) + "W")}
    
//nur für Awattar
  if (awattar == 1) {
    var startTime0 = getState( Javascript + ".electricity.prices.0.startTime").val,
        endTime0 = getState(Javascript + ".electricity.prices.0.endTime").val,
        price0 = getState(Javascript + ".electricity.prices.0.price").val
  };  
//Parametrierung Speicher
  if (bat != 1785) {
    RmgChaTm = getState(RemainChrgTime).val/3600
    if (DevType < 9300) {
      var batchrgmode = getState(Bat_Chrg_Mode).val
    }
  }
  // Lademenge
  var ChaEnrg_full = Math.ceil((batcap * (100 - batsoc) / 100)*(1+1-wr_eff))
  var ChaEnrg = ChaEnrg_full
  ChaEnrg = Math.max(Math.ceil((batcap * (bat_ziel - batsoc) / 100)*(1+1-wr_eff)), 0);
  var ChaTm = ChaEnrg/batwr_pwr; //Ladezeit

  if ( bat != 1785 && ChaTm <= 0 ) {
    ChaTm = RmgChaTm
    ChaEnrg = ChaEnrg_full
  }
  if ( bat == 1785 && ChaTm <= 0 ) {
    ChaTm = ChaEnrg_full/batwr_pwr
    ChaEnrg = ChaEnrg_full
  }
  // PB ... Regelung nur bei Schnellladung
  if ( DevType < 9300 && bat != 1785 && batchrgmode != 1767 ) {
    ChaTm = 0
    ChaEnrg = 0
  }  
// Ende der Parametrierung
  if (debug == 1){console.log("Lademenge " + ChaEnrg + "Wh")}
  if (debug == 1){console.log("Restladezeit " + ChaTm.toFixed(2) + "h")}

// Start der Awattar Sektion
  if (awattar == 1){
    let poi = [];
      for (let t = 0; t < 12 ; t++) {
        poi[t] = [getState(Javascript + ".electricity.prices."+ t + ".price").val, getState(Javascript + ".electricity.prices."+ t + ".startTime").val, getState(Javascript + ".electricity.prices."+ t + ".endTime").val];
    };
    poi.sort(function(a, b, c){
      return a[0] - b[0];
    });

    let lowprice = []; //wieviele Ladestunden unter Startcharge Preis
    for (let x = 0; x < poi.length; x++) {
      if (poi[x][0] < start_charge){
        lowprice[x] = poi[x];
      }
    };

    if (compareTime(startTime0, endTime0, "between")){
      if (price0) {
        // entladung stoppen wenn bezugspreis günstiger wie Batterieentladepreis ist.
        if (price0 <= stop_discharge && ChaTm >= lowprice.length ) {
          maxdischrg = 0
        }
        var sunup, sundown
        for (let sd = 0; sd < 48 ; sd++) {
          if (getState(Javascript + ".electricity.pvforecast."+ sd + ".power").val < grundlast) {
            sundown = getState(Javascript + ".electricity.pvforecast."+ sd + ".startTime").val
            for (let su = sd; su < 48 ; su++) {
              if (getState(Javascript + ".electricity.pvforecast."+ su + ".power").val > grundlast) {
                sunup = getState(Javascript + ".electricity.pvforecast."+ su + ".startTime").val
                su = 48
              }
            }  
            sd = 48
            if ( sunup === "" ){sunup = '09:00'} //nur falls die Sonne nicht mehr aufgeht ;) 
          }
        }
        if (debug == 1){console.log('Nachtfenster:' + sundown + '-' + sunup)}
        //if (compareTime({astro: 'sunsetStart', offset: -60}, {astro: 'sunriseEnd', offset: 60}, "between")){
          // calc number of bat runtime hrs left
          var batlefthrs = (batcap*(batsoc-batlimit))/100/(grundlast*(1+1-wr_eff))
          // wieviel Stunden bis Sonnenaufgang
          var dt = new Date(),
              dtmonth = "" + (dt.getMonth() + 1),
              dtday = "" + dt.getDate(),
              dtyear = dt.getFullYear()
          if (dtmonth.length < 2) dtmonth = "0" + dtmonth
          if (dtday.length < 2) dtday = "0" + dtday;
          var dateF = [dtyear, dtmonth, dtday]
          var sunriseend = getDateObject(dateF + " " + sunup + ":00").getTime()
          if (compareTime(sunriseend, null, ">", null)) {sunriseend = sunriseend + 86400000}
          var hrstosun = (sunriseend - getDateObject(dt).getTime())/3600000
          if (debug == 1){console.log("Bat h verbleibend " + batlefthrs.toFixed(2) + ", Stunden bis Sonnenaufgangende " + hrstosun.toFixed(2))}    

          let poihigh = [];
          for (let t = 0; t < Math.ceil(hrstosun) ; t++) {
            poihigh[t] = [getState(Javascript + ".electricity.prices."+ t + ".price").val, getState(Javascript + ".electricity.prices."+ t + ".startTime").val, getState(Javascript + ".electricity.prices."+ t + ".endTime").val];
          };
          poihigh.sort(function(a, b, c){
            return b[0] - a[0];
          });

          var lefthrs = 0
          if (batlefthrs < hrstosun) {lefthrs = batlefthrs}
          for (let d = 0; d < Math.ceil(lefthrs) ; d++) {
            if (compareTime(poihigh[d][1], poihigh[d][2], "not between")){
            maxdischrg = 0
            }
          }
        }
        //ladung stoppen wenn Restladezeit kleiner Billigstromzeitfenster
        if (lowprice.length > 0 && ChaTm <= lowprice.length) {
          maxchrg = 0
          awattar_active = 1
        };
        if (price0 < start_charge) {
          maxchrg = 0
          maxdischrg = 0
          awattar_active = 1
          // Erhaltungsladung PB
          if (batsoc <= batlimit && bat != 1785) { 
            maxchrg = 100
            maxdischrg = 0
            SpntCom = 802
            PwrAtCom = -100
          }

          for (let i = 0; i <= Math.ceil(ChaTm); i++) {
            if (compareTime(lowprice[i][1], lowprice[i][2], "between")){
              maxchrg = maxchrg_def
              maxdischrg = 0
              SpntCom = 802
              PwrAtCom = -PwrAtCom_def
            };
          };
        };
      };
    };
  };
// Ende der Awattar Sektion

// Start der PV Prognose Sektion
  var latesttime
  var pvfc = []
  var f = 0
  for (let p = 0; p < 48 ; p++) { /* 48 = 24h a 30min Fenster*/
    var pvpower50 = getState(Javascript + ".electricity.pvforecast."+ p + ".power").val,
        pvpower90 = getState(Javascript + ".electricity.pvforecast."+ p + ".power90").val,
        pvendtime = getState(Javascript + ".electricity.pvforecast."+ p + ".endTime").val,
        pvstarttime = getState(Javascript + ".electricity.pvforecast."+ p + ".startTime").val,
        grundlast_calc = grundlast
    if (compareTime(pvstarttime, pvendtime, "between")){
      grundlast_calc = pwr_verbrauch
    }
    if ( pvpower90 >= (pvlimit+grundlast_calc) ){
      if (compareTime(pvendtime, null, "<=", null)) {
        var minutes = 30
        if (pvpower50 < (pvlimit+grundlast_calc)){
          var minutes = Math.round((100-(((pvlimit-pvpower50)/((pvpower90-pvpower50)/40))+50))*18/60)
        }  
        pvfc[f] = [pvpower50, pvpower90, minutes, pvstarttime, pvendtime];
        f++;
      }
    };
  };
  if (pvfc.length > 0){latesttime = pvfc[(pvfc.length-1)][4]}
    pvfc.sort(function(b, a){
            return a[1] - b[1];
  });
  if (debug == 1){console.log(pvfc)}
  if (debug == 1){console.log("Abschluss bis " + latesttime)}
  var max_pwr = batwr_pwr;

  // verschieben des Ladevorgangs in den Bereich der PV Limitierung.
  if ( ChaTm > 0 && (ChaTm*2) <= pvfc.length && batsoc >= batminlimit) {
    // Bugfix zur behebung der array interval von 30min und update interval 1h
    if ((compareTime(latesttime, null, "<=", null)) && awattar_active == 0) {
      maxchrg = 0;
    }
    //berechnung zur entzerrung entlang der pv kurve, oberhalb des einspeiselimits
    var get_wh = 0;
    for (let k = 0; k < pvfc.length; k++) {
      var pvpower = pvfc[k][0]
      if (pvpower < pvlimit){
        pvpower = pvfc[k][1]
      }
      minutes = pvfc[k][2]
      if (compareTime(pvfc[k][3], pvfc[k][4], "between")){
        //rechne restzeit aus
        var now = new Date();
        var options = { hour12: false, hour: '2-digit', minute:'2-digit'}
        var nowTime = now.toLocaleTimeString('de-DE', options)
        var startsplit = nowTime.split(":")
        var endsplit = pvfc[k][4].split(":")
        var minutescalc = (Number(endsplit[0])*60 + Number(endsplit[1]))-(Number(startsplit[0])*60 + Number(startsplit[1]))
        if (minutescalc < minutes){
          minutes = minutescalc
        }
      }
      get_wh = get_wh + (((pvpower/2)-((pvlimit+grundlast_calc)/2))*(minutes/30)) // wieviele Wh Überschuss???
    }
    if (debug == 1){console.log("Überschuß " + get_wh.toFixed(0) + "Wh")}
    var pvlimit_calc = pvlimit,
        min_pwr = 0
    //Scenario 4
    if (ChaEnrg > get_wh && ChaEnrg > 0 && ChaTm > 0){
      if ((ChaTm*2) <= pvfc.length){
        ChaTm = pvfc.length/2 //entzerren des Ladevorganges
      }
      if (awattar_active == 0){
        pvlimit_calc = Math.max((Math.round(pvlimit - ((ChaEnrg - get_wh)/ChaTm))),0) //virtuelles reduzieren des pvlimits
        min_pwr = Math.max(Math.round((ChaEnrg - get_wh)/ChaTm),0)
      }
      get_wh = ChaEnrg // sprungpunkt in Scenario 5 
      if (debug == 1){console.log("Verschiebe Einspeiselimit auf " + pvlimit_calc + "W" + " mit mindestens " + min_pwr + "W")}
    }
    
    //Scenario 5
    if (get_wh >= ChaEnrg && ChaEnrg > 0){
      ChaTm = pvfc.length/2      
      var current_pwr_diff = 100-pvlimit_calc+cur_power_out //bleibe 100W unter dem Limit (PV-WR Trigger)

      if (awattar_active == 0){
        max_pwr = Math.round(power_ac+current_pwr_diff)
        if ( power_ac <= 0 && current_pwr_diff < 0 ){
          max_pwr = 0
        }
      }
      //aus der begrenzung holen...
      if (power_ac <= 10 && current_pwr_diff > 0 ){ 
        max_pwr = Math.round(pvfc[0][1]-pvlimit_calc)
        if (current_pwr_diff > max_pwr){
          max_pwr = current_pwr_diff
          if (awattar_active == 1){
            SpntCom = 803
            PwrAtCom = PwrAtCom_def
          }
        }
      }
    }

    max_pwr = Math.min(Math.max(max_pwr, min_pwr), maxchrg_def) //abfangen negativer werte, limitiere auf min_pwr
    //berechnung Ende

    for (let h = 0; h < (ChaTm*2); h++) {
      if ((compareTime(pvfc[h][3], pvfc[h][4], "between")) || (cur_power_out + power_ac) >= (pvlimit-100)){ 
        maxchrg = max_pwr;
      }; 
    };
  };
// Ende der PV Prognose Sektion

//write data
if (debug == 1){console.log(maxchrg + "!=" + maxchrg_def + "||" + maxchrg + "!=" + lastmaxchrg + "||" + maxdischrg + "!=" + maxdischrg_def + "||" + maxdischrg + "!=" + lastmaxdischrg)}
if (maxchrg != maxchrg_def || maxchrg != lastmaxchrg || maxdischrg != maxdischrg_def || maxdischrg != lastmaxdischrg) {
  if (debug == 1){console.log("Daten an WR:" + maxchrg + ', '+ maxdischrg)}
  setState(CmpBMSOpMod, bms, false);
  setState(BatChaMaxW, maxchrg, false);
  setState(BatDsChaMaxW, maxdischrg, false);
  //alle SBS BatWR brauchen mehr Daten
  if ((DevType >= 9324 && DevType <= 9326) || (DevType >= 9356 && DevType <= 9359) ){
    //delayed ab 5. register ... WR Überlastung
    setStateDelayed(BatChaMinW, minchrg, false, 1000);
    setStateDelayed(BatDsChaMinW, mindischrg, false, 1000);
  }
  if ( DevType >= 9300 ){
    setStateDelayed(SollAC, GridWSpt, false, 1000);
  }
}
lastmaxchrg = maxchrg
lastmaxdischrg = maxdischrg

  if (debug == 1){console.log(SpntCom + "!=" + SpntCom_def + "||" + SpntCom + "!=" + lastSpntCom)}
if (SpntCom != SpntCom_def || SpntCom != lastSpntCom) {
  if (debug == 1){console.log("Daten an WR:" + SpntCom + ', ' + PwrAtCom)}
  setState(FedInSpntCom, SpntCom, false);
  setState(FedInPwrAtCom, PwrAtCom, false);
}
lastSpntCom = SpntCom

}
var Interval = setInterval(function () {
  processing(); /*start processing in interval*/
}, (update*1000));
