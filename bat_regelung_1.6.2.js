/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/
// Debug
var debug = 0; /*debug ausgabe ein oder aus 1/0 */

// statische Parameter
var update = 15, /*Update interval in sek, 15 ist ein guter Wert*/
    pvpeak = 12090, /*pv anlagenleistung Wp */
    batcap = 25344, /*batterie kapazität in Wh, statisch wegen fehlerhafter Berechnung im SI*/
    surlimit = 70, /*pv einspeise limit in % */
    bat_grenze = 10, /*nutzbare mindestladung der Batterie, nicht absolutwert sondern zzgl unterer entladegrenze des Systems! z.b. 50% Entladetiefe + 10% -> bat_grenze = 10*/
    grundlast = 200, /*Grundlast in Watt falls bekannt*/
    wr_eff = 0.958, /* max BatWR Effizienz laut Datenblatt 0.95=95%, 1.0=100% */
    ModBusBat = "modbus.2"; /*ID der Modbusinstanz im ioBroker für den BatterieWR*/

// ab hier Awattar Bereich
var awattar = 0, /*wird Awattar benutzt (dyn. Strompreis) 0=nein, 1=ja*/
    gridprice = 16.065, /*(netto bezugspreis)*/
    taxprice = gridprice * 0.19, /*Deutscher Sonderweg, Eigenverbrauch wird mit Steuer aus entgangenen Strombezug besteuert.*/
    pvprice = 12.31,  /*pv preis*/
    start_charge = pvprice + taxprice, /*Eigenverbrauchspreis*/
    vis = 0, /*visualisierung der Strompreise nutzen ? 0=nein, 1=ja*/
    lossfactor = 35; /*System gesamtverlust in %, nur für Awattar Preisberechnung*/

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
    RemainChrgTime = ModBusBat + ".inputRegisters.31007_RmgChaTm", /*verbleibende Restladezeit für Boost Ladung (nur PB Speicher?)*/
    PowerOut = ModBusBat + ".inputRegisters.30867_TotWOut", /*aktuelle Einspeiseleistung am Netzanschlußpunkt, BatWR*/
    /*PowerOut = "sma-em.0.1900208590.psurplus",*/ /*aktuelle Einspeiseleistung am Netzanschlußpunkt, SMA-EM Adapter*/
    WMaxCha = ModBusBat + ".holdingRegisters.40189_WMaxCha", /*max Ladeleistung BatWR*/
    WMaxDsch = ModBusBat + ".holdingRegisters.40191_WMaxDsch", /*max Entladeleistung BatWR*/
    BatType = ModBusBat + ".holdingRegisters.40035_BatType", /*Abfrage Batterietyp*/
    PowerAC = ModBusBat + ".inputRegisters.30775_PowerAC", /*Power AC*/
    Dev_Type = ModBusBat + ".inputRegisters.30053_DevTypeId", /*Typnummer*/
    GridVoltage = ModBusBat + ".inputRegisters.30783_GridV1", /*Spannung L1 am WR*/
    bms_def = 2424,
    SpntCom_def = 803;

// ab hier Programmcode, nichts ändern!
function processing() {
// Start der Parametrierung
  var batsoc = getState(BAT_SoC).val,
      batlimit = getState(SelfCsmpDmLim).val,
      cur_power_out = getState(PowerOut).val,
      batminlimit = batlimit+bat_grenze,
      batwr_pwr = getState(WMaxCha).val,
      maxchrg_def = batwr_pwr,
      maxdischrg_def = getState(WMaxDsch).val,
      gridvolt = getState(GridVoltage).val,
      PwrAtCom_def = batwr_pwr,
      PwrAtCom_calc = Math.round(batwr_pwr/230*gridvolt),
      bat = getState(BatType).val,
      power_ac = getState(PowerAC).val*-1,
      pvlimit = (pvpeak / 100 * surlimit)+grundlast,
      DevType = getState(Dev_Type).val,
      /* Default Werte setzen*/
	  RmgChaTm = 0,
      bms = bms_def, 
      minchrg = 0,
      maxchrg = maxchrg_def,
      mindischrg = 0,
      maxdischrg = maxdischrg_def,
      GridWSpt = 0,
      SpntCom = SpntCom_def,
      PwrAtCom = PwrAtCom_def;

//nur für Awattar
  if (awattar == 1) {
    var startTime0 = getState("javascript.0.electricity.prices.0.startTime").val,
        endTime0 = getState("javascript.0.electricity.prices.0.endTime").val,
        price0 = getState("javascript.0.electricity.prices.0.price").val,
        loadfact = (lossfactor/100)+1,
        stop_discharge = start_charge * loadfact;
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

  if ( bat != 1785 && ChaTm <= 0 && RmgChaTm != 0 ) {
    ChaTm = RmgChaTm
    ChaEnrg = ChaEnrg_full
  }
  // float Situation PB ... keine Regelung da nur erhaltungsladung
  if ( bat != 1785 && RmgChaTm == 0 ) {
    ChaTm = 0
    ChaEnrg = 0
  }
// Ende der Parametrierung
  if (debug == 1){console.log("Lademenge " + ChaEnrg + "Wh")}
  if (debug == 1){console.log("Restladezeit " + ChaTm.toFixed(1) + "h")}

// Start der Awattar Sektion
  if (awattar == 1){
    let poi = [];
      for (let t = 0; t < 12 ; t++) {
        poi[t] = [getState("javascript.0.electricity.prices."+ t + ".price").val, getState("javascript.0.electricity.prices."+ t + ".startTime").val, getState("javascript.0.electricity.prices."+ t + ".endTime").val];
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
        if (price0 < stop_discharge && batsoc <= batminlimit) {
          bms = 2290;
          maxdischrg = 0;
        }
        if (batsoc >= batlimit && ChaTm != 0 && Math.ceil(ChaTm) <= lowprice.length) {     
          for (let a = 0; a < poi.length; a++) {
            if (poi[a][0] < start_charge){
              bms = 2289;
              maxchrg = 0;
            };
          };
        };      
        if (price0 < start_charge) {
          bms = 2289;
          maxchrg = 0;
          maxdischrg = 0;
          SpntCom = 802;
          PwrAtCom = 0;
          if (batsoc <= batlimit) {
            bms = 2289;
            maxchrg = 100;
            maxdischrg = 0;
            SpntCom = 802;
            PwrAtCom = -100;
          }

          for (let i = 0; i < Math.ceil(ChaTm); i++) {
            if (compareTime(poi[i][1], poi[i][2], "between")){
              bms = 2289;
              maxchrg = maxchrg_def;
              maxdischrg = 0;
              SpntCom = 802;
              PwrAtCom = PwrAtCom_calc*-1;
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
  for (let p = 0; p < 48 ; p++) { /* 24 = 12h a 30min Fenster*/
    var pvpower = getState("javascript.0.electricity.pvforecast."+ p + ".power").val;
      if ( pvpower >= pvlimit){
        var pvendtime = getState("javascript.0.electricity.pvforecast."+ p + ".startTime").val,
            pvstarttime = formatDate(getDateObject((getDateObject(pvendtime).getTime() - 1800000)), "SS:mm");
        if (compareTime(pvendtime, null, "<=", null)) {
          pvfc[f] = [pvpower, pvstarttime, pvendtime]
          f++
        }
      };
    };
  if (pvfc.length > 0){latesttime = pvfc[(pvfc.length-1)][2]}
    pvfc.sort(function(b, a){
            return a[0] - b[0];
  });
  if (debug == 1){console.log(pvfc)}
  if (debug == 1){console.log("Abschluss bis " + latesttime)}
  var max_pwr = batwr_pwr;

  // verschieben des Ladevorgangs in den Bereich der PV Limitierung.
  if ( ChaTm > 0 && (ChaTm*2) <= pvfc.length && batsoc >= batminlimit) {
    // Bugfix zur behebung der array interval von 30min und update interval 1h
    if (compareTime(latesttime, null, "<=", null)) {
      bms = 2289;
      maxchrg = 0;
    }
    //berechnung zur entzerrung entlang der pv kurve, oberhalb des einspeiselimits
    var get_wh = 0;
    for (let k = 0; k < pvfc.length; k++) {
      get_wh = get_wh + ((pvfc[k][0]/2)-(pvlimit/2)) // wieviele Wh Überschuss???
    }
    if (debug == 1){console.log("Überschuß " + get_wh.toFixed(0) + "Wh")}

    if (get_wh >= ChaEnrg && ChaEnrg > 0){
      ChaTm = pvfc.length/2
      var current_pwr_diff = 100-(pvlimit-grundlast)+cur_power_out //bleibe 100W unter dem Limit (PV-WR Trigger)
      if (debug == 1){console.log("Berechnung:" + '100' + '-' + (pvlimit-grundlast) + '+' + cur_power_out)}
      if (debug == 1){console.log("Berechnung Power:" + power_ac + '+' + current_pwr_diff)}
      max_pwr = Math.round(power_ac+current_pwr_diff)
      if ( power_ac <= 0 && current_pwr_diff < 0 ){
        max_pwr = 0
      }
      //aus der begrenzung holen.
      if (power_ac <= 10 && current_pwr_diff > 0 ){ 
        max_pwr = Math.round(pvfc[0][0]-(pvlimit-grundlast))
        if (current_pwr_diff > max_pwr){
          max_pwr = current_pwr_diff
        }
      }
    }    
    if (ChaEnrg > get_wh && ChaEnrg > 0 && ChaTm > 0){
      if ((ChaTm*2) <= pvfc.length){
      ChaTm = pvfc.length/2
      }
      max_pwr = Math.round(ChaEnrg/ChaTm);
    }

    max_pwr = Math.min(Math.max(max_pwr, 0), maxchrg_def) //abfangen negativer werte, limitiere auf 0
    //berechnung Ende

    for (let h = 0; h < (ChaTm*2); h++) {
      if (debug == 1){console.log(pvfc[h][1] + '-' + pvfc[h][2] + '-> ' + pvfc[h][0]+'W')}
      if (compareTime(pvfc[h][1], pvfc[h][2], "between")){ 
        bms = 2289;
        maxchrg = max_pwr;
        maxdischrg = maxdischrg_def,
        SpntCom = SpntCom_def,
        PwrAtCom = PwrAtCom_def;
      }; 
    };
  };
// Ende der PV Prognose Sektion

//write data
if (debug == 1){console.log("Daten an WR:" + bms + ', '+ maxchrg + ', '+ maxdischrg + ', ' + SpntCom + ', ' + PwrAtCom)}
setState(CmpBMSOpMod, bms, false);
setState(BatChaMaxW, maxchrg, false);
setState(BatDsChaMaxW, maxdischrg, false);
setState(FedInSpntCom, SpntCom, true);
setState(FedInPwrAtCom, PwrAtCom, true);
//SBS BatWR brauchen mehr Daten
if ((DevType >= 9324 && DevType <= 9326) || (DevType >= 9356 && DevType <= 9359) ){
  //delayed ab 5. register ... WR Überlastung
  setStateDelayed(BatChaMinW, minchrg, false, 1000);
  setStateDelayed(BatDsChaMinW, mindischrg, false, 1000);
  setStateDelayed(SollAC, GridWSpt, false, 1000);
}
if (awattar == 1 && vis == 1){
  createState("javascript.0.electricity.prices.batprice", 0, {
                    read: true,
                    write: true,
                    name: "Bat_Preis",
                    type: "number",
                    def: 0
                });
  createState("javascript.0.electricity.prices.PVprice", 0, {
                    read: true,
                    write: true,
                    name: "PV_Preis",
                    type: "number",
                    def: 0
                });                
  setState("javascript.0.electricity.prices.batprice",stop_discharge, true); /*dient nur für Visualisierung*/
  setState("javascript.0.electricity.prices.PVprice", start_charge, true); /*dient nur für Visualisierung*/
};
};

var Interval = setInterval(function () {
  processing(); /*start processing in interval*/
}, (update*1000));