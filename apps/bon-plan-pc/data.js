/* Bon Plan PC : données partagées (Analyse + Duel de Silicium) */

// GPU : [nom, marque, archi, année, VRAM Go, conso W, prix lancement $, indice perf (RTX 4090 = 100, raster 1440p)]
const GPU_RAW = [
 ["RTX 5090","N","Blackwell",2025,32,575,1999,125],["RTX 5080","N","Blackwell",2025,16,360,999,82],
 ["RTX 5070 Ti","N","Blackwell",2025,16,300,749,73],["RTX 5070","N","Blackwell",2025,12,250,549,60],
 ["RTX 5060 Ti 16 Go","N","Blackwell",2025,16,180,429,41],["RTX 5060 Ti 8 Go","N","Blackwell",2025,8,180,379,40],
 ["RTX 5060","N","Blackwell",2025,8,145,299,35],["RTX 5050","N","Blackwell",2025,8,130,249,25.5],
 ["RTX 4090","N","Ada",2022,24,450,1599,100],["RTX 4080 Super","N","Ada",2024,16,320,999,78],
 ["RTX 4080","N","Ada",2022,16,320,1199,77],["RTX 4070 Ti Super","N","Ada",2024,16,285,799,68],
 ["RTX 4070 Ti","N","Ada",2023,12,285,799,63],["RTX 4070 Super","N","Ada",2024,12,220,599,59],
 ["RTX 4070","N","Ada",2023,12,200,599,51],["RTX 4060 Ti 16 Go","N","Ada",2023,16,165,499,37.5],
 ["RTX 4060 Ti 8 Go","N","Ada",2023,8,160,399,37],["RTX 4060","N","Ada",2023,8,115,299,29],
 ["RTX 3090 Ti","N","Ampere",2022,24,450,1999,64],["RTX 3090","N","Ampere",2020,24,350,1499,58],
 ["RTX 3080 Ti","N","Ampere",2021,12,350,1199,56],["RTX 3080","N","Ampere",2020,10,320,699,53],
 ["RTX 3070 Ti","N","Ampere",2021,8,290,599,44],["RTX 3070","N","Ampere",2020,8,220,499,41],
 ["RTX 3060 Ti","N","Ampere",2020,8,200,399,36],["RTX 3060","N","Ampere",2021,12,170,329,26],
 ["RTX 3050","N","Ampere",2022,8,130,249,17],
 ["RTX 2080 Ti","N","Turing",2018,11,250,999,39],["RTX 2080 Super","N","Turing",2019,8,250,699,33],
 ["RTX 2080","N","Turing",2018,8,215,699,31],["RTX 2070 Super","N","Turing",2019,8,215,499,28],
 ["RTX 2070","N","Turing",2018,8,175,499,25],["RTX 2060 Super","N","Turing",2019,8,175,399,23],
 ["RTX 2060","N","Turing",2019,6,160,349,20],
 ["GTX 1660 Super","N","Turing16",2019,6,125,229,15.5],["GTX 1660 Ti","N","Turing16",2019,6,120,279,15.5],
 ["GTX 1660","N","Turing16",2019,6,120,219,14],["GTX 1650 Super","N","Turing16",2019,4,100,159,11.5],
 ["GTX 1650","N","Turing16",2019,4,75,149,8.5],
 ["GTX 1080 Ti","N","Pascal",2017,11,250,699,23],["GTX 1080","N","Pascal",2016,8,180,599,18],
 ["GTX 1070 Ti","N","Pascal",2017,8,180,449,16.5],["GTX 1070","N","Pascal",2016,8,150,379,15],
 ["GTX 1060 6 Go","N","Pascal",2016,6,120,249,10.5],["GTX 1050 Ti","N","Pascal",2016,4,75,139,6],

 ["RX 9070 XT","A","RDNA4",2025,16,304,599,74],["RX 9070","A","RDNA4",2025,16,220,549,66],
 ["RX 9060 XT 16 Go","A","RDNA4",2025,16,160,349,43],["RX 9060 XT 8 Go","A","RDNA4",2025,8,150,299,41],
 ["RX 7900 XTX","A","RDNA3",2022,24,355,999,79],["RX 7900 XT","A","RDNA3",2022,20,315,899,69],
 ["RX 7900 GRE","A","RDNA3",2023,16,260,549,59],["RX 7800 XT","A","RDNA3",2023,16,263,499,55],
 ["RX 7700 XT","A","RDNA3",2023,12,245,449,46],["RX 7600 XT","A","RDNA3",2024,16,190,329,29],
 ["RX 7600","A","RDNA3",2023,8,165,269,27],
 ["RX 6950 XT","A","RDNA2",2022,16,335,1099,58],["RX 6900 XT","A","RDNA2",2020,16,300,999,54],
 ["RX 6800 XT","A","RDNA2",2020,16,300,649,51],["RX 6800","A","RDNA2",2020,16,250,579,45],
 ["RX 6750 XT","A","RDNA2",2022,12,250,549,38],["RX 6700 XT","A","RDNA2",2021,12,230,479,36],
 ["RX 6700","A","RDNA2",2021,10,175,null,32],["RX 6650 XT","A","RDNA2",2022,8,180,399,29],
 ["RX 6600 XT","A","RDNA2",2021,8,160,379,27],["RX 6600","A","RDNA2",2021,8,132,329,23],
 ["RX 6500 XT","A","RDNA2",2022,4,107,199,10],
 ["RX 5700 XT","A","RDNA1",2019,8,225,399,25],["RX 5700","A","RDNA1",2019,8,180,349,22],
 ["RX 5600 XT","A","RDNA1",2020,6,150,279,19],["RX Vega 64","A","Vega",2017,8,295,499,17],
 ["RX 590","A","Polaris",2018,8,225,279,12.5],["RX 580 8 Go","A","Polaris",2017,8,185,229,11.5],
 ["RX 570","A","Polaris",2017,4,150,169,10],

 ["Arc B580","I","Battlemage",2024,12,190,249,31],["Arc B570","I","Battlemage",2025,10,150,219,27],
 ["Arc A770 16 Go","I","Alchemist",2022,16,225,349,26],["Arc A750","I","Alchemist",2022,8,225,289,24],
 ["Arc A580","I","Alchemist",2023,8,185,179,21],["Arc A380","I","Alchemist",2022,6,75,139,8]
];
const ARCH = {
 Blackwell:{rt:1.05,up:"DLSS 4 · multi frame gen",lbl:"Blackwell"}, Ada:{rt:1.03,up:"DLSS 4 · frame gen",lbl:"Ada Lovelace"},
 Ampere:{rt:1,up:"DLSS 4",lbl:"Ampere"}, Turing:{rt:.88,up:"DLSS 4",lbl:"Turing"},
 Turing16:{rt:0,up:"FSR 3 (via le jeu)",lbl:"Turing (GTX 16)"}, Pascal:{rt:0,up:"FSR 3 (via le jeu)",lbl:"Pascal"},
 RDNA4:{rt:.92,up:"FSR 4",lbl:"RDNA 4"}, RDNA3:{rt:.72,up:"FSR 3.1",lbl:"RDNA 3"}, RDNA2:{rt:.62,up:"FSR 3.1",lbl:"RDNA 2"},
 RDNA1:{rt:0,up:"FSR 3.1",lbl:"RDNA 1"}, Vega:{rt:0,up:"FSR 2",lbl:"Vega"}, Polaris:{rt:0,up:"FSR 2",lbl:"Polaris"},
 Battlemage:{rt:.95,up:"XeSS 2 · frame gen",lbl:"Battlemage"}, Alchemist:{rt:.88,up:"XeSS",lbl:"Alchemist"}
};
// CPU : [nom, marque, cœurs, threads, boost GHz, TDP W, socket, année, prix $, indice jeu (9800X3D = 100), mono CB R23, multi CB R23]
const CPU_RAW = [
 ["Ryzen 7 9800X3D","A",8,16,5.2,120,"AM5",2024,479,100,2050,23000],["Ryzen 9 9950X3D","A",16,32,5.7,170,"AM5",2025,699,97,2230,41000],
 ["Ryzen 9 9950X","A",16,32,5.7,170,"AM5",2024,649,82,2270,42000],["Ryzen 9 9900X","A",12,24,5.6,120,"AM5",2024,499,81,2230,33000],
 ["Ryzen 7 9700X","A",8,16,5.5,65,"AM5",2024,359,81,2200,20500],["Ryzen 5 9600X","A",6,12,5.4,65,"AM5",2024,279,79,2150,16800],
 ["Ryzen 7 7800X3D","A",8,16,5.0,120,"AM5",2023,449,91,1780,18000],["Ryzen 9 7950X3D","A",16,32,5.7,120,"AM5",2023,699,90,2040,35500],
 ["Ryzen 9 7950X","A",16,32,5.7,170,"AM5",2022,699,80,2050,38000],["Ryzen 9 7900X","A",12,24,5.6,170,"AM5",2022,549,79,2020,29000],
 ["Ryzen 7 7700X","A",8,16,5.4,105,"AM5",2022,399,79,2000,19800],["Ryzen 5 7600X","A",6,12,5.3,105,"AM5",2022,299,76,1950,15000],
 ["Ryzen 5 7600","A",6,12,5.1,65,"AM5",2023,229,74,1880,14200],
 ["Ryzen 7 5800X3D","A",8,16,4.5,105,"AM4",2022,449,77,1480,14500],["Ryzen 7 5700X3D","A",8,16,4.1,105,"AM4",2024,249,74,1430,13500],
 ["Ryzen 9 5950X","A",16,32,4.9,105,"AM4",2020,799,65,1650,26000],["Ryzen 9 5900X","A",12,24,4.8,105,"AM4",2020,549,65,1630,21500],
 ["Ryzen 7 5800X","A",8,16,4.7,105,"AM4",2020,449,64,1580,15200],["Ryzen 7 5700X","A",8,16,4.6,65,"AM4",2022,299,63,1530,14000],
 ["Ryzen 5 5600X","A",6,12,4.6,65,"AM4",2020,299,62,1550,11000],["Ryzen 5 5600","A",6,12,4.4,65,"AM4",2022,199,61,1500,10800],
 ["Ryzen 5 5500","A",6,12,4.2,65,"AM4",2022,159,54,1420,10000],["Ryzen 7 3700X","A",8,16,4.4,65,"AM4",2019,329,50,1270,12000],
 ["Ryzen 5 3600","A",6,12,4.2,65,"AM4",2019,199,48,1250,9200],["Ryzen 5 2600","A",6,12,3.9,65,"AM4",2018,199,40,1050,7500],
 ["Ryzen 5 1600","A",6,12,3.6,65,"AM4",2017,219,34,950,6800],

 ["Core Ultra 9 285K","I",24,24,5.7,125,"LGA1851",2024,589,78,2300,42000],["Core Ultra 7 265K","I",20,20,5.5,125,"LGA1851",2024,394,77,2180,36000],
 ["Core Ultra 5 245K","I",14,14,5.2,125,"LGA1851",2024,309,73,2050,24500],
 ["Core i9-14900K","I",24,32,6.0,125,"LGA1700",2023,589,84,2280,38500],["Core i7-14700K","I",20,28,5.6,125,"LGA1700",2023,409,82,2150,35000],
 ["Core i5-14600K","I",14,20,5.3,125,"LGA1700",2023,319,77,2000,24500],["Core i5-14400F","I",10,16,4.7,65,"LGA1700",2024,196,66,1780,17000],
 ["Core i9-13900K","I",24,32,5.8,125,"LGA1700",2022,589,83,2200,38000],["Core i7-13700K","I",16,24,5.4,125,"LGA1700",2022,409,80,2100,30500],
 ["Core i5-13600K","I",14,20,5.1,125,"LGA1700",2022,319,76,1950,24000],["Core i5-13400F","I",10,16,4.6,65,"LGA1700",2023,196,64,1750,16000],
 ["Core i9-12900K","I",16,24,5.2,125,"LGA1700",2021,589,74,1990,27500],["Core i7-12700K","I",12,20,5.0,125,"LGA1700",2021,409,72,1920,23000],
 ["Core i5-12600K","I",10,16,4.9,125,"LGA1700",2021,289,69,1880,17500],["Core i5-12400F","I",6,12,4.4,65,"LGA1700",2022,167,61,1700,12000],
 ["Core i5-11400F","I",6,12,4.4,65,"LGA1200",2021,157,54,1450,10600],["Core i9-10900K","I",10,20,5.3,125,"LGA1200",2020,488,58,1350,14500],
 ["Core i7-10700K","I",8,16,5.1,125,"LGA1200",2020,374,56,1300,12500],["Core i5-10400F","I",6,12,4.3,65,"LGA1200",2020,155,48,1150,8800],
 ["Core i3-10100F","I",4,8,4.3,65,"LGA1200",2020,79,42,1150,5500],
 ["Core i9-9900K","I",8,16,5.0,95,"LGA1151",2018,488,55,1250,12500],["Core i7-9700K","I",8,8,4.9,95,"LGA1151",2018,374,52,1230,9800],
 ["Core i5-9600K","I",6,6,4.6,95,"LGA1151",2018,262,47,1180,6200],["Core i7-8700K","I",6,12,4.7,95,"LGA1151",2017,359,50,1200,9000],
 ["Core i5-8400","I",6,6,4.0,65,"LGA1151",2017,182,42,1050,5600],["Core i7-7700K","I",4,8,4.5,91,"LGA1151",2017,339,41,1150,5400]
];
// Jeux : g = FPS 1080p d'un GPU d'indice 100 sans limite CPU ; c = FPS max avec un 9800X3D ; e = plafond du moteur ; v = VRAM utile [1080p,1440p,4K] ; rt = coût du RT
const GAMES = [
 {n:"Cyberpunk 2077",s:"Ultra",g:223,c:210,v:[6.5,7.5,9.5],rt:.5},
 {n:"Fortnite",s:"Élevé · DX12",g:443,c:330,v:[4.5,5.5,7.5],rt:.75},
 {n:"Valorant",s:"Élevé",g:1540,c:900,v:[2,2.5,3.5]},
 {n:"Counter-Strike 2",s:"Élevé",g:885,c:650,v:[3,3.5,5]},
 {n:"Call of Duty: Black Ops 6",s:"Élevé",g:366,c:280,v:[6,7,9]},
 {n:"GTA V",s:"Très élevé",g:540,c:250,e:187,v:[3.5,4,5.5]},
 {n:"Red Dead Redemption 2",s:"Élevé",g:277,c:170,v:[5,6,8]},
 {n:"Elden Ring",s:"Maximum",g:290,c:150,e:60,v:[5,6,8]},
 {n:"Alan Wake 2",s:"Élevé",g:162,c:180,v:[7,8,11],rt:.55},
 {n:"Black Myth: Wukong",s:"Élevé",g:173,c:190,v:[6,7,9.5],rt:.5},
 {n:"Apex Legends",s:"Élevé",g:616,c:320,e:300,v:[4,5,7]},
 {n:"Forza Horizon 5",s:"Extrême",g:327,c:230,v:[6,7,9]},
 {n:"Hogwarts Legacy",s:"Élevé",g:270,c:140,v:[7,8,10],rt:.65},
 {n:"Rainbow Six Siege",s:"Élevé",g:924,c:550,v:[3.5,4.5,6]}
];
const GPUS = GPU_RAW.map(r=>({n:r[0],b:r[1],arch:r[2],y:r[3],vram:r[4],w:r[5],price:r[6],p:r[7]}));
const CPUS = CPU_RAW.map(r=>({n:r[0],b:r[1],c:r[2],t:r[3],ghz:r[4],w:r[5],sock:r[6],y:r[7],price:r[8],g:r[9],st:r[10],mt:r[11]}));
const G = n => GPUS.find(x=>x.n===n), C = n => CPUS.find(x=>x.n===n);
const VENDOR = {N:"Nvidia",A:"AMD",I:"Intel"};
const RES = {"1080":{f:1,l:"1080p",i:0},"1440":{f:.70,l:"1440p",i:1},"2160":{f:.41,l:"4K",i:2}};
const MY = {cpu:"Ryzen 5 3600", gpu:"RTX 2070 Super"};

/* ---------- Cote d'occasion indicative (France, fin 2026, en €) ----------
   Ordres de grandeur pour une pièce d'occasion en bon état, vendue en main propre.
   Chaque valeur est modifiable dans l'appli : ta propre cote est mémorisée. */
const USED_GPU = {
 "RTX 5090":1850,"RTX 5080":880,"RTX 5070 Ti":640,"RTX 5070":450,"RTX 5060 Ti 16 Go":340,"RTX 5060 Ti 8 Go":280,"RTX 5060":230,"RTX 5050":170,
 "RTX 4090":1450,"RTX 4080 Super":780,"RTX 4080":740,"RTX 4070 Ti Super":590,"RTX 4070 Ti":510,"RTX 4070 Super":470,"RTX 4070":400,
 "RTX 4060 Ti 16 Go":300,"RTX 4060 Ti 8 Go":250,"RTX 4060":200,
 "RTX 3090 Ti":650,"RTX 3090":600,"RTX 3080 Ti":450,"RTX 3080":330,"RTX 3070 Ti":270,"RTX 3070":240,"RTX 3060 Ti":210,"RTX 3060":170,"RTX 3050":120,
 "RTX 2080 Ti":250,"RTX 2080 Super":200,"RTX 2080":180,"RTX 2070 Super":170,"RTX 2070":150,"RTX 2060 Super":130,"RTX 2060":110,
 "GTX 1660 Super":90,"GTX 1660 Ti":90,"GTX 1660":80,"GTX 1650 Super":65,"GTX 1650":55,
 "GTX 1080 Ti":130,"GTX 1080":90,"GTX 1070 Ti":80,"GTX 1070":70,"GTX 1060 6 Go":50,"GTX 1050 Ti":40,
 "RX 9070 XT":550,"RX 9070":480,"RX 9060 XT 16 Go":300,"RX 9060 XT 8 Go":240,
 "RX 7900 XTX":700,"RX 7900 XT":550,"RX 7900 GRE":430,"RX 7800 XT":380,"RX 7700 XT":300,"RX 7600 XT":230,"RX 7600":190,
 "RX 6950 XT":400,"RX 6900 XT":360,"RX 6800 XT":330,"RX 6800":290,"RX 6750 XT":240,"RX 6700 XT":220,"RX 6700":190,
 "RX 6650 XT":170,"RX 6600 XT":160,"RX 6600":140,"RX 6500 XT":70,
 "RX 5700 XT":110,"RX 5700":95,"RX 5600 XT":85,"RX Vega 64":70,"RX 590":55,"RX 580 8 Go":50,"RX 570":35,
 "Arc B580":220,"Arc B570":180,"Arc A770 16 Go":180,"Arc A750":140,"Arc A580":110,"Arc A380":70
};
const USED_CPU = {
 "Ryzen 7 9800X3D":420,"Ryzen 9 9950X3D":600,"Ryzen 9 9950X":480,"Ryzen 9 9900X":330,"Ryzen 7 9700X":260,"Ryzen 5 9600X":190,
 "Ryzen 7 7800X3D":330,"Ryzen 9 7950X3D":450,"Ryzen 9 7950X":400,"Ryzen 9 7900X":280,"Ryzen 7 7700X":220,"Ryzen 5 7600X":160,"Ryzen 5 7600":150,
 "Ryzen 7 5800X3D":260,"Ryzen 7 5700X3D":180,"Ryzen 9 5950X":260,"Ryzen 9 5900X":190,"Ryzen 7 5800X":140,"Ryzen 7 5700X":120,
 "Ryzen 5 5600X":95,"Ryzen 5 5600":90,"Ryzen 5 5500":65,"Ryzen 7 3700X":80,"Ryzen 5 3600":55,"Ryzen 5 2600":35,"Ryzen 5 1600":25,
 "Core Ultra 9 285K":450,"Core Ultra 7 265K":280,"Core Ultra 5 245K":210,
 "Core i9-14900K":400,"Core i7-14700K":300,"Core i5-14600K":210,"Core i5-14400F":140,
 "Core i9-13900K":330,"Core i7-13700K":250,"Core i5-13600K":180,"Core i5-13400F":120,
 "Core i9-12900K":200,"Core i7-12700K":170,"Core i5-12600K":130,"Core i5-12400F":90,
 "Core i5-11400F":65,"Core i9-10900K":140,"Core i7-10700K":110,"Core i5-10400F":55,"Core i3-10100F":35,
 "Core i9-9900K":110,"Core i7-9700K":85,"Core i5-9600K":55,"Core i7-8700K":70,"Core i5-8400":35,"Core i7-7700K":45
};
// Carte mère d'occasion (milieu de gamme) selon le socket
const USED_MOBO = {AM5:110,AM4:60,LGA1851:140,LGA1700:90,LGA1200:55,LGA1151:40};
const SOCKET_NOTE = {
 AM5:{ok:1,t:"Plateforme AM5 : évolutive, AMD la soutient encore plusieurs générations."},
 AM4:{ok:0,t:"Plateforme AM4 : en fin de vie, mais tu peux encore monter jusqu'au Ryzen 7 5800X3D / 5700X3D."},
 LGA1851:{ok:1,t:"Plateforme LGA1851 : récente, DDR5 obligatoire."},
 LGA1700:{ok:0,t:"Plateforme LGA1700 : en fin de vie, évolution possible jusqu'au i9-14900K."},
 LGA1200:{ok:-1,t:"Plateforme LGA1200 : ancienne, évolution limitée (11e génération maximum)."},
 LGA1151:{ok:-1,t:"Plateforme LGA1151 : vieillissante, quasiment aucune évolution possible."}
};
const RAM_PRICE = {DDR4:{8:20,16:45,32:85,64:160}, DDR5:{16:70,32:130,64:250}};
const SSD_PRICE = {0:0,256:15,512:30,1000:55,2000:100,4000:200};
const HDD_PRICE = {0:0,1000:15,2000:25,4000:45};
const PSU_PRICE = {0:10,450:20,550:28,650:40,750:55,850:70,1000:95};
const CASE_PRICE = {basique:25,correct:45,premium:90};

/* ---------- FPS estimés (même modèle que le Duel) ---------- */
function estimateFps(gpu,cpu,game,res){
  const R = RES[res];
  let g = game.g*gpu.p/100*R.f;
  const need = game.v[R.i];
  let vram=false;
  if(gpu.vram < need){ g *= Math.max(.45, Math.pow(gpu.vram/need,1.6)); vram=true; }
  const c = game.c*cpu.g/100, e = game.e||Infinity;
  const fps = Math.min(g,c,e);
  const lim = (e<=g && e<=c) ? "engine" : (c<g ? "cpu" : "gpu");
  return {fps,lim,vram};
}
const geo = arr => Math.exp(arr.reduce((s,x)=>s+Math.log(Math.max(x,1)),0)/arr.length);
