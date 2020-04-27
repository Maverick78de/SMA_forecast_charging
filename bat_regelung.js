/*
MIT License - see LICENSE.md 
Copyright (c) [2020] [Matthias Boettger <mboe78@gmail.com>]
*/

// statische Parameter
var Interval,
    batcap = 25344, /*Batterie Kapazität in Wh*/
    pvpeak = 12090, /*pv anlagenleistung Wp */
    surlimit = 40, /*pv einspeise limit in % */
    grundlast = 200, /*Grundlast des Hauses, wenn nicht bekannt 0 lassen*/
    pvlimit = (pvpeak / 100 * surlimit)+grundlast,
    bat_grenze = 15, /*mindestladung der Batterie, nicht absolutwert sondern unterer entladegrenze des Systems, Bei Saisonbetrieb variabel!*/
    batwr_pwr = 4600, /*Ladeleistung des BatterieWR*/
    lossfact = 1.1, /*Ladeverlust Factor 1.1 = 10% Ladeverlust*/
    pb_bat = 1; /*Speicher ist Blei (=1), Blei Speicher laden nicht bis 100% im normalen Ladezyklus. Die Ladekurve flacht ab 85% extrem ab, daher wird nur bis 85% berechnet zur optimalen Energieausnutzung*/

// BAT-WR Register
var CmpBMSOpMod = "modbus.2.holdingRegisters.40236_CmpBMSOpMod"/*Betriebsart des BMS*/,
    BatChaMaxW = "modbus.2.holdingRegisters.40795_BatChaMaxW"/*Maximale Batterieladeleistung*/,
    BatDsChaMaxW = "modbus.2.holdingRegisters.40799_BatDschMaxW"/*Maximale Batterieentladeleistung*/,
    FedInSpntCom = "modbus.2.holdingRegisters.40151_FedInSpntCom"/*Wirk- und Blindleistungsregelung über Kommunikation*/,
    FedInPwrAtCom = "modbus.2.holdingRegisters.40149_FedInPwrAtCom"/*Wirkleistungsvorgabe*/,
    BAT_SoC = "modbus.2.inputRegisters.30845_BAT_SoC", /*selbserklärend ;) */
    SelfCsmpDmLim = "modbus.2.inputRegisters.31009_SelfCsmpDmLim", /*unteres Entladelimit Eigenverbrauchsbereich (Saisonbetrieb)*/
    RemainChrgTime = "modbus.2.inputRegisters.31007_RmgChaTm"; /*verbleibende Restladezeit für Boost Ladung (nur PB Speicher?)*/

// ab hier Awattar Bereich
var awattar = 1, /*wird Awattar benutzt (dyn. Strompreis) 0=nein, 1=ja*/
    gridprice = 16.992 /*(netto bezugspreis)*/,
    taxprice = gridprice * 0.19, /*Deutscher Sonderweg, Eigenverbrauch wird mit Steuer aus entgangenen Strombezug besteuert.*/
    pvprice = 12.31,  /*pv preis*/
    start_charge = pvprice + taxprice, /*Eigenverbrauchspreis*/
    vis = 1, /*visualisierung nutzen?*/
    Metering_WhIn = "modbus.2.inputRegisters.30595_Metering_WhIn", /*WR Wh geladen*/
    Metering_WhOut = "modbus.2.inputRegisters.30597_Metering_WhOut"; /*WR Wh entladen*/
// Ende Awattar

function processing() {
// Start der Parametrierung
  var batsoc = getState(BAT_SoC).val,
      batlimit = getState(SelfCsmpDmLim).val,
      RmgChaTm = Math.ceil(getState(RemainChrgTime).val/3600),
      batminlimit = batlimit+bat_grenze,
      ChaTm = Math.ceil((batcap * ((100 - batsoc) / 100)/batwr_pwr)*lossfact),
      /*BMS Default des BatWR (SI6.0H-11) */
      bms_def = 2424,
      maxchrg_def = 5100,
      maxdischrg_def = 5100,
      SpntCom_def = 803,
      PwrAtCom_def = 5100,
      /* Default Werte setzen*/
      bms = bms_def, 
      maxchrg = maxchrg_def,
      maxdischrg = maxdischrg_def,
      SpntCom = SpntCom_def,
      PwrAtCom = PwrAtCom_def;
  
//nur für Awattar
  if (awattar == 1) {
    var startTime0 = getState("javascript.0.electricity.prices.0.startTime").val,
        endTime0 = getState("javascript.0.electricity.prices.0.endTime").val,
        price0 = getState("javascript.0.electricity.prices.0.price").val,
        inwh = getState(Metering_WhIn).val,
        outwh = getState(Metering_WhOut).val,
        loadfact = 1-(outwh/inwh)+1,
        stop_discharge = start_charge * loadfact;
  };  
//Parametrierung Bleispeicher
  if (pb_bat == 1) {
    ChaTm = Math.ceil((batcap * ((85 - batsoc) / 100)/batwr_pwr)*lossfact);
    if ( ChaTm == 0 ) {
      ChaTm = RmgChaTm
    }
    //PB float situation "Erhaltungsladung"
    if ( batsoc >= 85 && RmgChaTm == 0 ) {
      ChaTm =  0;
    }
  }
// Ende der Parametrierung
  console.log(ChaTm + "h");  

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
    for (let x = 0; x < ChaTm; x++) {
      if (poi[x][0] < start_charge){
        lowprice[x] = [poi[x][0]];
      }
    };
    //console.log(lowprice.length)

    if (compareTime(startTime0, endTime0, "between"))  {
      if (price0) {
        if (price0 < stop_discharge && batsoc <= batminlimit) {
          bms = 2290;
          maxdischrg = 0;
        }
        if (batsoc >= batlimit && ChaTm != 0 && ChaTm <= lowprice.length) {     
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

          for (let i = 0; i < ChaTm; i++) {
            if (compareTime(poi[i][1], poi[i][2], "between")){
              bms = 2289;
              maxchrg = maxchrg_def;
              maxdischrg = 0;
              SpntCom = 802;
              PwrAtCom = PwrAtCom_def*-1;
            };
          };
        };
      };
    };
  };
// Ende der Awattar Sektion

// Start der PV Prognose Sektion
  let pvfc = [];
  let f = 0;
    for (let p = 0; p < 24 ; p++) { /* 24 = 12h a 30min Fenster*/
        var pvpower = getState("javascript.0.electricity.pvforecast."+ p + ".power").val;
        if ( pvpower >= pvlimit){
            var pvendtime = getState("javascript.0.electricity.pvforecast."+ p + ".startTime").val,
                pvstarttime = formatDate(getDateObject((getDateObject(pvendtime).getTime() - 1800000)), "SS:mm");
            pvfc[f] = [pvpower, pvstarttime, pvendtime];
            f++;
        };
    };
  //console.log(pvfc);
  
  pvfc.sort(function(b, a){
            return a[0] - b[0];
  });

  // *Neu* Entzerrung des Ladevorgangs auf die Dauer der Anlagenbegrenzung
  if ( ChaTm > 0 && (ChaTm*2) < pvfc.length){
	var ChaTm_old = ChaTm;
    ChaTm = Math.floor(pvfc.length/2);
  };
  // verschieben des Ladevorgangs in den Bereich der PV Limitierung.
  if ( ChaTm > 0 && (ChaTm*2) <= pvfc.length && batsoc >= batminlimit ) {
    bms = 2289;
    maxchrg = 0;
    for (let h = 0; h < (ChaTm*2); h++) {
      console.log(pvfc[h][1] + ', ' + pvfc[h][2] + ', ' + pvfc[h][0])
      if (compareTime(pvfc[h][1], pvfc[h][2], "between")){ 
        bms = 2289;
        maxchrg = Math.round(batwr_pwr*(ChaTm_old*2)/pvfc.length);
        maxdischrg = maxdischrg_def,
        SpntCom = SpntCom_def,
        PwrAtCom = PwrAtCom_def;
      }; 
    };
  };
// Ende der PV Prognose Sektion

//write data
console.log(bms + ', ' + maxchrg + ', ' + maxdischrg + ', ' + SpntCom + ', ' + PwrAtCom)
setState(CmpBMSOpMod, bms);
setState(BatChaMaxW, maxchrg);
setState(BatDsChaMaxW, maxdischrg);
setState(FedInSpntCom, SpntCom);
setState(FedInPwrAtCom, PwrAtCom);
if (awattar == 1 && vis == 1){
  setState("javascript.0.electricity.prices.batprice",stop_discharge); /*dient nur für Visualisierung*/
  setState("javascript.0.electricity.prices.PVprice", start_charge); /*dient nur für Visualisierung*/
};
};

Interval = setInterval(function () {
  processing(); /*start processing in interval*/
}, 60000);
