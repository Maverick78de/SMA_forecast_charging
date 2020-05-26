/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/
/*Version 2.1-beta 2020/05/25 */
// Debug
var debug = 1; /*debug ausgabe ein oder aus 1/0 */

// statische Parameter
var update = 15, /*Update interval in sek, 15 ist ein guter Wert*/
    pvpeak = 12090, /*pv anlagenleistung Wp */
    batcap = 25344, /*batterie kapazität in Wh, statisch wegen fehlerhafter Berechnung im SI*/
    surlimit = 70, /*pv einspeise limit in % */
    bat_grenze = 10, /*nutzbare mindestladung der Batterie, nicht absolutwert sondern zzgl unterer entladegrenze des Systems! z.b. 50% Entladetiefe + 10% -> bat_grenze = 10*/
    grundlast = 200, /*Grundlast in Watt falls bekannt*/
    wr_eff = 0.958, /* max BatWR Effizienz laut Datenblatt 0.95=95%, 1.0=100% */
    bat_wr_pwr = 0, /* Ladeleistung der Batterie in W, 0=automatik (wird ausgelesen)*/
    pv_ac_pwr = 11500, /*Leistung der PV Wechselrichter (Max AC Power)*/
    ModBusBat = "modbus.2", /*ID der Modbusinstanz im ioBroker für den BatterieWR*/
    ModBusPV = "modbus.0", /*ID der Modbusinstanz im ioBroker für den PV-WR, Angabe optional (leer lassen wenn nicht möglich)*/
    SMA_EM = "sma-em.0.1900208590", /*Name der SMA EnergyMeter/HM2 Instanz bei installierten SAM-EM Adapter, leer lassen wenn nicht vorhanden*/
    Javascript = "javascript.0"; /*ID der Javascript Instanz*/

// ab hier Awattar Bereich
var awattar = 1, /*wird Awattar benutzt (dyn. Strompreis) 0=nein, 1=ja*/
    gridprice = 16.065, /*(netto bezugspreis)*/
    taxprice = gridprice * 0.19, /*Deutscher Sonderweg, Eigenverbrauch wird mit Steuer aus entgangenen Strombezug besteuert.*/
    pvprice = 12.31,  /*pv preis*/
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
    Bat_Chrg_Mode =ModBusBat + ".inputRegisters.30853_ActiveChargeMode", /*Aktives Batterieladeverfahren*/
    bms_def = 2424,
    SpntCom_def = 803,
    lastbms = 0,
    lastSpntCom = 0,
    awattar_active = 0;
// PV-WR Register Definition, nur bei Bedarf anpassen
  var PV_Dev_Type = ModBusPV + ".inputRegisters.30053_DevTypeId", /*Typnummer*/
      PVWR_limit = ModBusPV + ".holdingRegisters.41255_WNomPrc";
// Awattar + Vis
if (awattar == 1 && vis == 1){
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
  // nur SIx-11
  if (DevType < 9300) {
    var batchrgmode = getState(Bat_Chrg_Mode).val
  }
  var batsoc = getState(BAT_SoC).val,
      cur_power_out = getState(PowerOut).val,
      batminlimit = batlimit+bat_grenze,
      batwr_pwr = bat_wr_pwr
      if (bat_wr_pwr == 0){
        batwr_pwr = getState(WMaxCha).val;        
      }
  var maxchrg_def = batwr_pwr,
      maxdischrg_def = getState(WMaxDsch).val,
      PwrAtCom_def = Math.round(batwr_pwr*(1+1-wr_eff)),
      bat = getState(BatType).val,
      power_ac = getState(PowerAC).val*-1,
      pvlimit = (pvpeak / 100 * surlimit),
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
      PVDevType = 0,
      pvwrlimit = 100;
    
  if (ModBusPV != "") {
    PVDevType = getState(PV_Dev_Type).val
    if (PVDevType >= 9300){
      var pvwrlimit = Math.min(getState(PVWR_limit).val, 100)
    }
  }

//nur für Awattar
  if (awattar == 1) {
    var startTime0 = getState( Javascript + ".electricity.prices.0.startTime").val,
        endTime0 = getState(Javascript + ".electricity.prices.0.endTime").val,
        price0 = getState(Javascript + ".electricity.prices.0.price").val
  };  
//Parametrierung Speicher
  if (bat != 1785) {
    RmgChaTm = getState(RemainChrgTime).val/3600
  }
  // Lademenge
  var ChaEnrg_full = Math.ceil((batcap * (100 - batsoc) / 100)*(1+1-wr_eff))
  var ChaEnrg = ChaEnrg_full
  if (bat != 1785 && RmgChaTm != 0) /* 1785 = Li-Ion*/{
    ChaEnrg = Math.max(Math.ceil((batcap * (85 - batsoc) / 100)*(1+1-wr_eff)), 0);
  }
  var ChaTm = ChaEnrg/batwr_pwr; //Ladezeit

  if ( bat != 1785 && ChaTm <= 0 ) {
    ChaTm = RmgChaTm
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
    for (let x = 0; x < Math.ceil(ChaTm); x++) {
      if (poi[x][0] < start_charge){
        lowprice[x] = [poi[x][0]];
      }
    };

    if (compareTime(startTime0, endTime0, "between"))  {
      if (price0) {
        // entladung stoppen wenn bezugspreis günstiger wie Batterieentladepreis und wenn batmindesladung erreicht ist. (Reserve)
        if (price0 < stop_discharge && batsoc <= batminlimit && ChaTm > 0 ) {
          //bms = 2290
          maxdischrg = 0
        }
        //ladung stoppen wenn Restladezeit größer oder kleiner Billigstromzeitfenster
        if (batsoc >= batlimit && ChaTm > 0 && Math.ceil(ChaTm) <= lowprice.length) {     
          for (let a = 0; a < poi.length; a++) {
            if (poi[a][0] < start_charge){
              //bms = 2289
              maxchrg = 0
              awattar_active = 1
            };
          };
        };
        if (price0 < start_charge && ChaTm > 0) {
          //bms = 2289
          maxchrg = 0
          maxdischrg = 0
          awattar_active = 1
          // Erhaltungsladung PB
          if (batsoc <= batlimit && bat != 1785) { 
            //bms = 2289
            maxchrg = 100
            maxdischrg = 0
            SpntCom = 802
            PwrAtCom = -100
          }
          for (let i = 0; i < Math.ceil(ChaTm); i++) {
            if (compareTime(poi[i][1], poi[i][2], "between")){
              //bms = 2289
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
  var latesttime;
  let pvfc = [];
  let f = 0;
  for (let p = 0; p < 48 ; p++) { /* 48 = 24h a 30min Fenster*/
    var pvpower50 = getState(Javascript + ".electricity.pvforecast."+ p + ".power").val,
        pvpower90 = getState(Javascript + ".electricity.pvforecast."+ p + ".power90").val;
    if ( pvpower90 >= (pvlimit+grundlast) ){
      var pvendtime = getState(Javascript + ".electricity.pvforecast."+ p + ".startTime").val,
          pvstarttime = formatDate(getDateObject((getDateObject(pvendtime).getTime() - 1800000)), "SS:mm");
      if (compareTime(pvendtime, null, "<=", null)) {
        var minutes = 30
        if (pvpower50 < (pvlimit+grundlast)){
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
      //bms = 2289;
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
      get_wh = get_wh + (((pvpower/2)-((pvlimit+grundlast)/2))*(minutes/30)) // wieviele Wh Überschuss???
    }
    if (debug == 1){console.log("Überschuß " + get_wh.toFixed(0) + "Wh")}
    var pvlimit_calc = pvlimit
    //Scenario 4
    if (ChaEnrg > get_wh && ChaEnrg > 0 && ChaTm > 0){
      if ((ChaTm*2) <= pvfc.length){
        ChaTm = pvfc.length/2 //entzerren des Ladevorganges
      }
      if (awattar_active == 0){
        pvlimit_calc = Math.max((Math.round(pvlimit - ((ChaEnrg - get_wh)/ChaTm))),0) //virtuelles reduzieren des pvlimits
      }
      get_wh = ChaEnrg // sprungpunkt in Scenario 5 
      if (debug == 1){console.log("Verschiebung Einspeiselimit auf " + pvlimit_calc + "W")}
    }
    
    //Scenario 5
    if (get_wh >= ChaEnrg && ChaEnrg > 0){
      ChaTm = pvfc.length/2      
      var current_pwr_diff = -pvlimit_calc+cur_power_out
      if (PVDevType < 9300){
        current_pwr_diff = 100-pvlimit_calc+cur_power_out //bleibe 100W unter dem Limit (PV-WR Trigger)
      }
      max_pwr = Math.round(power_ac+current_pwr_diff)
      if ( power_ac <= 0 && current_pwr_diff < 0 ){
        max_pwr = 0
      }
      //aus der begrenzung holen...
      //alte WR Methode
      if (PVDevType < 9300){
        if (power_ac <= 10 && current_pwr_diff > 0 ){ 
          max_pwr = Math.round(pvfc[0][1]-pvlimit_calc)
          if (current_pwr_diff > max_pwr){
            max_pwr = current_pwr_diff
          }
        }
      }
      //neue WR Methode
      if (PVDevType >= 9300){
        var begr_fakt = (100-pvwrlimit)/100;         
        max_pwr = max_pwr + (pv_ac_pwr*begr_fakt)
      }
    }

    max_pwr = Math.min(Math.max(max_pwr, 0), maxchrg_def) //abfangen negativer werte, limitiere auf 0
    //berechnung Ende

    for (let h = 0; h < (ChaTm*2); h++) {
      if ((compareTime(pvfc[h][3], pvfc[h][4], "between")) || (cur_power_out + power_ac) >= (pvlimit-100)){ 
        //bms = 2289;
        maxchrg = max_pwr;
      }; 
    };
  };
// Ende der PV Prognose Sektion

//write data
//if (debug == 1){console.log(bms + "!=" + bms_def + "||" + bms + "!=" + lastbms)}
//if (bms != bms_def || bms != lastbms) {
  if (debug == 1){console.log("Daten an WR:" + bms + ', '+ minchrg + ', '+ maxchrg + ', '+ mindischrg + ', '+ maxdischrg + ', ' + GridWSpt + ', '+ SpntCom + ', ' + PwrAtCom)}
  setState(CmpBMSOpMod, bms, false);
  setState(BatChaMaxW, maxchrg, false);
  setState(BatDsChaMaxW, maxdischrg, false);
  if (debug == 1){console.log(SpntCom + "!=" + SpntCom_def + "||" + SpntCom + "!=" + lastSpntCom)}
  if (SpntCom != SpntCom_def || SpntCom != lastSpntCom) {
    setState(FedInSpntCom, SpntCom, false);
    setState(FedInPwrAtCom, PwrAtCom, false);
  }
  //alle SBS BatWR brauchen mehr Daten
  if ((DevType >= 9324 && DevType <= 9326) || (DevType >= 9356 && DevType <= 9359) ){
  //delayed ab 5. register ... WR Überlastung
    setStateDelayed(BatChaMinW, minchrg, false, 1000);
    setStateDelayed(BatDsChaMinW, mindischrg, false, 1000);
  }
  if ( DevType >= 9300 ){
    setStateDelayed(SollAC, GridWSpt, false, 1000);
  }
//}
//lastbms = bms
lastSpntCom = SpntCom
};

var Interval = setInterval(function () {
  processing(); /*start processing in interval*/
}, (update*1000));
