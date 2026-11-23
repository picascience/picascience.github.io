window.DATA3={
title:"Macro · Dossier 3 · Séance 3",
intro:`<p><b>Dossier 3 : le Tableau Entrées-Sorties (TES) et le calcul du PIB.</b> Pour le quiz : sache <b>calculer un PIB</b> (onglet « Quiz type » → calculs illimités), <b>lire le tableau B</b> en lignes / colonnes, et le <b>prix d'acquisition</b>. Ensuite les effets directs / indirects de la hausse de l'énergie.</p>`,
carte:`<style>.mm .br{border-left:3px solid;padding:2px 0 2px 12px;margin:0 0 16px 4px}.mm .br h2{font-size:16px;margin:0 0 8px}.mm .n{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 6px;font-size:14.5px}.mm .n small{display:block;color:var(--mut);font-size:12.5px}.mm .top{background:var(--acc2);border:1.5px solid var(--acc);border-radius:14px;padding:12px;text-align:center;margin:0 0 6px}.mm .top span{font-family:"Cambria Math",Georgia,serif;font-size:14px}
.tes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:0 0 14px}.tes div{border:1.5px solid var(--line);border-radius:10px;padding:8px 6px;text-align:center;font-size:12.5px;background:var(--card)}.tes b{display:block;font-size:20px;color:var(--acc)}.tes .e{visibility:hidden}</style><div class="mm">
<div class="top"><b>Le TES (Leontief, 1941)</b><br><span>Lignes = produits i · Colonnes = branches j</span></div>
<div class="tes"><div><b>A</b>Ressources<br>P, IM, IP, SP, MC</div><div><b>B</b>Consommations intermédiaires</div><div><b>C</b>Emplois finals<br>DC, FBCF, VS, EX</div><div class="e"></div><div><b>D</b>Compte de production<br>P − CI = VAB</div><div class="e"></div><div class="e"></div><div><b>E</b>Compte d'exploitation<br><small>(non vu)</small></div><div class="e"></div></div>
<div class="br" style="border-color:#1D9E75"><h2>Lecture</h2>
<div class="n"><b>Ligne (horizontale)</b><small>Équilibre emplois-ressources de chaque produit, au prix d'acquisition. Dans B : à qui sert le produit i (ses débouchés en CI).</small></div>
<div class="n"><b>Colonne (verticale)</b><small>Dans B : ce que consomme la branche j pour produire (sa recette de CI). Total en bas = CI de la branche.</small></div>
<div class="n"><b>Diagonale</b><small>Autoconsommations : la branche consomme ses propres produits (foin pour les bovins, composants électroniques).</small></div></div>
<div class="br" style="border-color:#7F77DD"><h2>PIB : 3 approches, même résultat</h2>
<div class="n"><b>Production</b><small>PIB = ΣVAB + IP − SP = P − CI + IP − SP</small></div>
<div class="n"><b>Emplois finals (approche de référence)</b><small>PIB = DC + FBCF + VS + OV + EX − IM</small></div>
<div class="n"><b>Revenus</b><small>Vue plus tard dans le cours</small></div></div>
<div class="br" style="border-color:#D85A30"><h2>Utilisations</h2>
<div class="n"><b>Structure</b><small>Taux d'utilisation intermédiaire / finale, contribution à la VAB, taux de couverture, branches motrices / entraînées</small></div>
<div class="n"><b>Prévision</b><small>Coefficients techniques a<sub>ij</sub> = CI<sub>ij</sub> / P<sub>j</sub> → matrice de Leontief → vagues successives</small></div>
<div class="n"><b>Énergie 2021-2022</b><small>Effets indirects de la hausse de l'énergie : passent par les CI, donc par le TES</small></div></div></div>`,
fiche:[
{t:"Le quiz type de la séance (réponses modèles)",s:"Dossier TD 3 p.1",h:`
<p><b>1. Calculez le PIB</b> (IM 629,1 · DC 1 679,8 · FBCF 466,9 · OV 0,7 · VS −2,4 · EX 597,8)</p>
<span class="f">PIB = DC + FBCF + VS + OV + EX − IM</span>
<span class="f">= 1 679,8 + 466,9 − 2,4 + 0,7 + 597,8 − 629,1 = 2 113,7</span>
<p>Attention au <b>signe de la VS</b> (−2,4 : déstockage) et à bien <b>soustraire</b> les importations.</p>
<p><b>2. Lignes / colonnes du tableau B</b> : en <b>ligne</b>, pour chaque produit i, ses débouchés en consommation intermédiaire dans chaque branche (qui l'utilise et combien). En <b>colonne</b>, pour chaque branche j, la valeur des CI qu'elle consomme dans chaque produit (de quoi elle a besoin pour produire). Sur la <b>diagonale</b> : les autoconsommations.</p>
<p><b>3. Prix pour l'équilibre emplois-ressources</b> : au <b>prix d'acquisition</b>.</p>
<span class="f">Prix d'acquisition = prix de base + IP − SP (+ MC)</span>
<p>La production est au prix de base : on ajoute les impôts sur les produits, on retire les subventions sur les produits (et les marges commerciales) pour passer au prix d'acquisition.</p>
<p><b>4. Secteurs les plus consommateurs d'énergie</b> : voir ta figure 1 (doc 1). En général : cokéfaction-raffinage, chimie, métallurgie, papier-carton, matériaux non métalliques (verre, ciment), transports, agriculture. Le critère : la <b>part des CI en énergie dans la production</b> de la branche.</p>
<p><b>5. Effets directs / indirects</b> : <b>direct</b> = les ménages paient plus cher l'énergie qu'ils achètent eux-mêmes (carburant, électricité, gaz, fioul). <b>Indirect</b> = les entreprises paient plus cher leurs CI en énergie et répercutent la hausse sur le prix des autres biens et services. Le TES sert à mesurer l'<b>effet indirect</b>.</p>`},
{t:"Le TES : 5 tableaux",s:"Poly D3 p.1",h:`
<p>Proposé par <b>Wassily Leontief</b> (1941). Il montre l'<b>interdépendance des branches</b> : qui utilise les produits de qui, et la valeur ajoutée de chaque branche. Il est complémentaire du TEE. Utilisé par les États-Unis en 1945 pour simuler l'impact du désarmement.</p>
<ul>
<li><b>A — Ressources en produits</b> : production (prix de base), importations, IP, SP, marges commerciales → total ressources au prix d'acquisition.</li>
<li><b>B — Consommations intermédiaires</b> (échanges interbranches) : <b>le cœur du TES</b>.</li>
<li><b>C — Emplois finals</b> : DC (ménages, APU), FBCF, VS, exportations.</li>
<li><b>D — Compte de production</b> des branches : P − CI = VAB.</li>
<li><b>E — Compte d'exploitation</b> : partage de la VA entre travail et capital (non vu en détail).</li>
</ul>
<p>Lignes = <b>produits</b> i. Colonnes = <b>branches</b> j.</p>`},
{t:"L'exemple du poly à connaître",s:"Poly D3 p.2–3",h:`
<p>4 branches : agriculture, industrie, construction, services.</p>
<ul>
<li>Production : 40 · 540 · 111 · 830 = <b>1 521</b></li>
<li>CI des branches : 24 · 380 · 70 · 382 = <b>856</b></li>
<li>VAB : 16 · 160 · 41 · 448 = <b>665</b></li>
<li>IM 260 · IP 121 · SP −12 → total ressources <b>1 890</b></li>
<li>Emplois finals : DC ménages 546, DC APU 33, FBCF 197, VS 8, EX 250 → 1 034</li>
</ul>
<h3>Équilibre produit industrie</h3>
<span class="f">540 + 233 + 51 + 73 − 1 = 370 + 238 + 10 + 63 + 208 + 7 = 896</span>
<h3>Équilibre global</h3>
<span class="f">1 521 + 260 + 121 − 12 = 856 + 546 + 33 + 197 + 250 + 8 = 1 890</span>
<p>Au global, les <b>marges commerciales s'annulent</b> (la colonne MC totalise 0) : elles passent d'un produit à l'autre (−58 en services).</p>
<h3>PIB de l'exemple</h3>
<span class="f">Production : 1 521 − 856 + 121 − 12 = 774</span>
<span class="f">Emplois : (546 + 33) + 197 + 8 + (250 − 260) = 774</span>`},
{t:"Lire le tableau B (lignes, colonnes, diagonale)",s:"Poly D3 p.2–3",h:`
<ul>
<li><b>En ligne</b> : débouchés du produit i en CI. Ex. sur 896 de produits industriels, 262 vont à l'industrie elle-même, 14 à l'agriculture, 29 à la construction, 65 aux services (total 370 en CI).</li>
<li><b>En colonne</b> : ce que la branche j consomme. Ex. l'agriculture utilise 14 de produits industriels et 7 de produits agricoles ; total <b>24</b> de CI.</li>
<li><b>Diagonale</b> = autoconsommations : 7 pour l'agriculture, 262 pour l'industrie. Elles dépendent de la finesse de la classification des branches.</li>
</ul>
<p>Le <b>total ligne de B + total ligne de C</b> = emplois totaux du produit, au prix d'acquisition. Le <b>total colonne de C</b> donne la valeur d'un emploi final (ex. toute la DC des ménages) : répartition entre secteurs.</p>`},
{t:"Prix de base et prix d'acquisition",s:"Poly D3 p.2, p.6",h:`
<span class="f">Prix de base = prix d'acquisition − IP + SP − MC</span>
<span class="f">Prix d'acquisition = prix de base + IP − SP + MC</span>
<ul>
<li><b>Prix de base</b> = ce que <b>touche le producteur</b>. La production et la VAB sont au prix de base.</li>
<li><b>Prix d'acquisition</b> (= prix du marché) = ce que <b>paie l'acheteur</b>. L'équilibre emplois-ressources et le PIB sont au prix d'acquisition / du marché.</li>
</ul>`},
{t:"Valeur ajoutée et PIB (approche production)",s:"Poly D3 p.3, p.6",h:`
<span class="f">VAB = Production (prix de base) − CI</span>
<p>La VA = la <b>nouvelle richesse créée</b> par la branche. On ne somme pas les productions : sinon les CI seraient <b>comptées deux fois</b>.</p>
<span class="f">PIB (prix du marché) = ΣVAB + IP − SP = P − CI + IP − SP</span>
<p>La correction IP − SP sert à passer du prix de base au prix du marché.</p>`},
{t:"PIB : approche emplois finals",s:"Poly D3 p.6–7",h:`
<span class="f">PIB = DC + FBCF + VS + OV + EX − IM</span>
<p>= emplois finals intérieurs + solde extérieur. EX − IM = <b>solde de la balance commerciale</b>. C'est l'<b>approche de référence</b> (emplois déjà au prix d'acquisition, pas besoin de justifier les impôts sur les importations).</p>
<span class="f">FBC = FBCF + VS + OV</span>
<span class="f">Y = C + I + G + (X − M)</span>
<p>C = conso des ménages · I = investissement des entreprises (et ménages) · G = dépense publique (FBCF + conso finale des APU). La 3<sup>e</sup> approche (revenus) sera vue plus tard.</p>`},
{t:"Ratios de structure de l'économie",s:"Poly D3 p.4",h:`
<span class="f">Taux d'utilisation intermédiaire de i = CI en produit i / ressources en i</span>
<span class="f">Taux d'utilisation finale de i = emplois finals en i / ressources en i</span>
<span class="f">Contribution à la VAB de i = VAB de la branche i / VAB totale</span>
<span class="f">Taux de couverture = Σ exportations / Σ importations</span>
<p>Les deux premiers taux font <b>100 %</b> à eux deux. Couverture &gt; 100 % : excédent commercial.</p>
<p><b>Branches motrices</b> : elles consomment beaucoup de CI des autres branches, donc les entraînent (le <b>bâtiment</b>). <b>Branches entraînées</b> : elles consomment peu de CI des autres.</p>`},
{t:"Coefficients techniques et prévision",s:"Poly D3 p.4–5",h:`
<span class="f">a<sub>i,j</sub> = CI du produit i par la branche j / production de la branche j</span>
<p>Ex. a<sub>ind,agr</sub> = 14 / 40 = <b>0,35</b> : pour produire 1 € de produit agricole, l'agriculture utilise 35 centimes de produits industriels.</p>
<p>Tous les a<sub>ij</sub> forment la <b>matrice de Leontief</b>. Si l'industrie produit 20 de plus, <b>1<sup>re</sup> vague</b> : elle demande a<sub>i,ind</sub> × 20 à chaque branche (0,667 agriculture, 9,704 industrie, 0,148 construction, 3,555 services). Ces branches produisent plus, donc consomment plus : <b>2<sup>e</sup> vague</b>, etc., qui s'essouffle.</p>
<h3>Les 4 limites (hypothèse de stabilité des coefficients)</h3>
<ul>
<li><b>Prix relatifs</b> des CI stables (sinon le rapport de valeurs change).</li>
<li><b>Rendements d'échelle constants</b>.</li>
<li><b>Pas de progrès technique</b> (qui réduirait les CI nécessaires).</li>
<li><b>Pas de substitution</b> entre CI et travail (« fonction de production à la Leontief »).</li>
</ul>`},
{t:"Exercice 3 corrigé (A, B, C)",s:"Dossier TD 3 ex.3",h:`
<p><b>Q1. Opération sur les produits</b> : opération qui décrit l'origine (production, importations) et l'utilisation (CI, DC, FBCF, VS, exportations) des biens et services.</p>
<p><b>Q2.</b> <span class="f">P + IM + IP − SP = CI + DC + FBCF + VS + EX</span></p>
<h3>Q3. Tableau B (lignes produits, colonnes branches A / B / C)</h3>
<ul>
<li>Produit A : 6 · 3 · 12 → <b>21</b></li>
<li>Produit B : 15 · 36 · <b>12</b> (63 − 15 − 36) → 63</li>
<li>Produit C : <b>12</b> · 18 · <b>6</b> → 36</li>
<li>CI des branches : <b>33</b> (81 − 48) · <b>57</b> · <b>30</b> → 120</li>
</ul>
<p>Détail : CI branche A = 81 − 48 = 33, donc C par A = 33 − 6 − 15 = 12. C par C = 36 − 12 − 18 = 6.</p>
<h3>Commerce extérieur (balance = EX − IM)</h3>
<ul><li>IM<sub>A</sub> = 36 − 33 = <b>3</b> · IM<sub>B</sub> = 69 − 51 = <b>18</b> · EX<sub>C</sub> = 18 + 30 = <b>48</b></li></ul>
<h3>Équilibres par produit</h3>
<ul>
<li>A : emplois = 21 + 30 + 36 = 87 = 81 + 3 + 15 − SP → <b>SP<sub>A</sub> = 12</b></li>
<li>B : emplois = 63 + 66 + 69 = 198 = P<sub>B</sub> + 18 + 21 − 3 → <b>P<sub>B</sub> = 162</b></li>
<li>C : ressources = 90 + 18 + 12 − 0 = 120 = 36 + EF + 48 → <b>EF<sub>C</sub> = 36</b></li>
</ul>
<h3>Compte de production</h3>
<ul><li>VAB : A 48 · B 162 − 57 = <b>105</b> · C 90 − 30 = <b>60</b> → <b>213</b></li><li>Total ressources = emplois = <b>405</b></li></ul>
<p><b>Q4. 1<sup>re</sup> ligne</b> : sur 87 de produits agricoles, 21 servent de CI : 6 à l'agriculture elle-même (autoconsommation), 3 à l'industrie, 12 aux services.</p>
<p><b>Q5. 2<sup>e</sup> colonne</b> : pour produire 162, l'industrie consomme 57 de CI : 3 de produits agricoles, 36 de produits industriels (autoconsommation), 18 de services.</p>
<h3>Q6. PIB</h3>
<span class="f">Production : 213 + 48 − 15 = 246</span>
<span class="f">Emplois : 132 + 153 − 39 = 246</span>
<h3>Q7. Structure</h3>
<ul>
<li>Utilisation intermédiaire : A 21/87 = 24 % · B 63/198 = 32 % · C 36/120 = 30 %</li>
<li>Contribution à la VAB : A 22,5 % · <b>B 49,3 %</b> · C 28,2 % → économie dominée par l'industrie</li>
<li>Couverture globale : 153 / 39 ≈ <b>392 %</b> (fort excédent) ; A 1 200 %, B 383 %, C 267 %</li>
</ul>`},
{t:"Exercices 1 et 2 corrigés (minerai, acier, autos, robots)",s:"Dossier TD 3 ex.1–2",h:`
<h3>Ex. 2 — Production au prix de base</h3>
<ul><li>A : 50 000 × 200 = 10 M · B : 15 000 × 3 000 = 45 M · C : 5 000 × 15 000 = 75 M · D : 10 + 2 × 5 = 20 M → <b>150 M</b></li></ul>
<h3>Pièges</h3>
<ul>
<li>La machine de A et les robots de C = <b>FBCF</b> (20 M), pas des CI.</li>
<li>C achète 20 M d'acier mais n'en utilise que 18 : CI = 18, les 2 M restants = <b>variation de stocks</b>.</li>
<li>Acier invendu chez B : 45 − 20 − 10 = 15 M → VS totale = <b>17 M</b>.</li>
<li>Moteurs importés : 5 000 × 4 000 = <b>20 M d'importations</b>, utilisés en CI par C.</li>
</ul>
<ul><li>CI : 0 · 10 · 38 · 10 = 58 M · VAB : 10 · 35 · 37 · 10 = <b>92 M</b></li></ul>
<h3>Ex. 2 Q3</h3>
<span class="f">PIB = 150 − 58 = 92 M</span>
<span class="f">Demande finale = 75 + 20 + 17 = 112 M = PIB + IM</span>
<h3>Ex. 1 — Coefficients techniques</h3>
<ul>
<li>a<sub>mines,transfo</sub> = 10 / 45 = 0,222</li>
<li>a<sub>transfo,conso</sub> = 18 / 75 = <b>0,24</b> : pour 1 € de voiture, 24 centimes d'acier.</li>
<li>a<sub>conso,conso</sub> = 20 / 75 = 0,267 · a<sub>transfo,capital</sub> = 10 / 20 = 0,5 · tous les autres = 0</li>
</ul>
<p><b>1<sup>re</sup> vague</b> de +1 000 voitures × 15 000 = +15 M : acier +0,24 × 15 = <b>3,6 M</b> ; biens de conso +0,267 × 15 = <b>4 M</b> (en réalité des moteurs importés) ; mines et biens de capital : 0. 2<sup>e</sup> vague : l'acier demande 0,222 × 3,6 = 0,8 M de minerai.</p>`},
{t:"Documents : la hausse des prix de l'énergie",s:"Dossier TD 3 docs 1–2 · Insee Analyses n°75",h:`
<ul>
<li><b>Mesurer l'importance de l'énergie</b> dans la production : la part des CI en produits énergétiques dans la production (ou les CI) de chaque branche, lue dans le <b>tableau B</b> du TES (= coefficient technique de l'énergie).</li>
<li><b>Début de la hausse</b> : à partir de la <b>mi-2021</b> (reprise post-Covid de la demande), amplifiée par la <b>guerre en Ukraine</b> (février 2022).</li>
<li><b>Effet direct</b> : l'énergie achetée par les ménages (carburant, chauffage, électricité). <b>Effet indirect</b> : la hausse des coûts des entreprises se transmet aux prix des autres produits → c'est là que le <b>TES</b> est utile.</li>
<li><b>Bouclier tarifaire</b> : gel des tarifs réglementés du gaz (octobre 2021), plafonnement de la hausse des tarifs de l'électricité, plus la remise à la pompe. Selon l'Insee, il a réduit environ <b>de moitié</b> l'effet de l'énergie sur l'inflation.</li>
<li><b>Effets de second tour</b> : les salaires et prix s'indexent sur l'inflation passée → nouvelle hausse des coûts → nouvelle hausse des prix (boucle prix-salaires).</li>
<li><b>Ménages inégaux</b> : les plus modestes (l'énergie pèse plus dans leur budget), les ruraux (voiture), les logements chauffés au fioul ou au gaz ou mal isolés sont plus touchés.</li>
</ul>
<p>Pour les chiffres précis (secteurs de la figure 1, schéma 1), reprends tes documents : je n'avais pas ces pages.</p>`}
],
qcm:[
{q:"Dans le TES, les lignes correspondent aux… et les colonnes aux…",c:["produits ; branches","branches ; produits","secteurs institutionnels ; produits","ménages ; entreprises"],a:0,e:"Lignes = produits i (équilibre emplois-ressources), colonnes = branches j.",s:"Poly D3 p.1"},
{q:"Le tableau considéré comme le « cœur » du TES est :",c:["Le tableau B des consommations intermédiaires","Le tableau A des ressources","Le tableau C des emplois finals","Le compte d'exploitation"],a:0,e:"Il fait apparaître les interdépendances entre branches.",s:"Poly D3 p.2"},
{q:"Qui a proposé le Tableau Entrées-Sorties ?",c:["Wassily Leontief","John Maynard Keynes","Simon Kuznets","François Quesnay"],a:0,e:"Leontief, The Structure of the American Economy 1919-1929 (1941).",s:"Poly D3 p.1"},
{q:"Lue en colonne, le tableau B indique :",c:["Les CI consommées par une branche dans chaque produit","Les débouchés d'un produit dans chaque branche","La production de chaque produit","Les emplois finals d'une branche"],a:0,e:"La colonne = ce que la branche j consomme pour produire. La ligne = débouchés du produit i.",s:"Poly D3 p.3"},
{q:"La diagonale du tableau B représente :",c:["Les autoconsommations des branches","Les exportations","La valeur ajoutée","Les importations de chaque produit"],a:0,e:"Consommation par une branche de ses propres produits (ex. 262 pour l'industrie).",s:"Poly D3 p.3"},
{q:"L'équilibre emplois-ressources dans le TES est vérifié :",c:["Au prix d'acquisition","Au prix de base","Au prix CAF","Au coût des facteurs"],a:0,e:"Les colonnes IP − SP (et MC) du tableau A font passer la production du prix de base au prix d'acquisition.",s:"Poly D3 p.2"},
{q:"Prix de base =",c:["Prix d'acquisition − IP + SP − MC","Prix d'acquisition + IP − SP","Prix d'acquisition + IP + SP","Prix d'acquisition − IP − SP + MC"],a:0,e:"Le producteur ne touche ni les impôts sur les produits ni les marges, mais touche les subventions.",s:"Poly D3 p.2"},
{q:"La valeur ajoutée brute d'une branche se calcule :",c:["Production au prix de base − CI","Production au prix d'acquisition − CI","Production − FBCF","Chiffre d'affaires − salaires"],a:0,e:"VAB = P (prix de base) − CI. C'est le solde du compte de production (tableau D).",s:"Poly D3 p.3"},
{q:"PIB (approche production) =",c:["ΣVAB + IP − SP","ΣVAB − IP + SP","Σ productions","ΣVAB + IM − EX"],a:0,e:"On corrige la VAB (prix de base) pour passer au prix du marché.",s:"Poly D3 p.6"},
{q:"Pourquoi le PIB ne somme-t-il pas les productions ?",c:["Les CI seraient comptées deux fois","Les importations seraient oubliées","Les impôts seraient exclus","La production n'est pas mesurable"],a:0,e:"Le PIB mesure le supplément de richesse créé, pas la production.",s:"Poly D3 p.6"},
{q:"PIB (approche emplois finals) =",c:["DC + FBCF + VS + OV + EX − IM","DC + FBCF + VS + OV + EX + IM","DC + CI + FBCF + EX − IM","P + IM − CI"],a:0,e:"Emplois finals intérieurs + solde extérieur.",s:"Poly D3 p.6"},
{q:"Avec IM 629,1 · DC 1 679,8 · FBCF 466,9 · OV 0,7 · VS −2,4 · EX 597,8, le PIB vaut :",c:["2 113,7","2 118,5","3 372,0","1 484,6"],a:0,e:"1 679,8 + 466,9 − 2,4 + 0,7 + 597,8 − 629,1 = 2 113,7. Piège : VS négative.",s:"Dossier TD 3, exemple de quiz"},
{q:"Quelle approche du PIB le poly qualifie-t-il d'« approche de référence » ?",c:["Les emplois finals","La production","Les revenus","La valeur ajoutée nette"],a:0,e:"Les emplois sont déjà au prix d'acquisition ; pas besoin de justifier les impôts sur les importations.",s:"Poly D3 p.6"},
{q:"La formation brute de capital (FBC) est égale à :",c:["FBCF + VS + OV","FBCF + DC","FBCF − VS","FBCF + EX − IM"],a:0,e:"FBC = OV + VS + FBCF.",s:"Poly D3 p.7"},
{q:"Le coefficient technique a(ind, agr) = 14 / 40 = 0,35 signifie :",c:["Pour produire 1 € de produit agricole, l'agriculture utilise 0,35 € de produits industriels","L'industrie utilise 35 % de produits agricoles","35 % de la production industrielle est exportée","L'agriculture vend 35 % de sa production à l'industrie"],a:0,e:"a(i,j) = CI du produit i par la branche j / production de j.",s:"Poly D3 p.4"},
{q:"Le coefficient technique a(i,j) se calcule :",c:["CI du produit i par la branche j / production de la branche j","CI du produit i / ressources en i","VAB de j / VAB totale","Production de j / production de i"],a:0,e:"On divise par la production effective de la branche qui consomme (j).",s:"Poly D3 p.4"},
{q:"La prévision par le TES repose sur l'hypothèse centrale de :",c:["Stabilité des coefficients techniques","Croissance constante du PIB","Plein emploi","Prix flexibles"],a:0,e:"Les coefficients de l'année t sont supposés valables en t+1, t+2…",s:"Poly D3 p.4–5"},
{q:"Laquelle n'est PAS une limite de la prévision par le TES ?",c:["La prise en compte du progrès technique","Prix relatifs des CI supposés stables","Rendements d'échelle supposés constants","Aucune substitution entre CI et travail"],a:0,e:"Justement, le TES suppose l'ABSENCE de progrès technique : c'est une limite.",s:"Poly D3 p.5"},
{q:"Une branche « motrice » est une branche qui :",c:["Consomme beaucoup de CI des autres branches et les entraîne","Produit beaucoup pour l'exportation","Consomme peu de CI","A la plus forte valeur ajoutée"],a:0,e:"Exemple classique : le bâtiment.",s:"Poly D3 p.4"},
{q:"Taux d'utilisation intermédiaire du produit i =",c:["CI en produit i / ressources en produit i","CI de la branche i / production de i","VAB de i / VAB totale","Exportations de i / importations de i"],a:0,e:"Avec le taux d'utilisation finale, la somme fait 100 %.",s:"Poly D3 p.4"},
{q:"Le taux de couverture global se calcule :",c:["Σ exportations / Σ importations","Σ importations / Σ exportations","EX − IM","Exportations / PIB"],a:0,e:"> 100 % : les exportations couvrent plus que les importations.",s:"Poly D3 p.4"},
{q:"Dans l'exemple du poly, la VAB de l'agriculture vaut :",c:["16","24","40","49"],a:0,e:"40 (production) − 24 (CI) = 16.",s:"Poly D3 p.3"},
{q:"Dans l'exemple du poly, le PIB vaut :",c:["774","665","1 521","1 890"],a:0,e:"1 521 − 856 + 121 − 12 = 774. 665 = VAB totale (prix de base), 1 890 = total ressources.",s:"Poly D3 p.7"},
{q:"Si l'industrie produit 20 de plus et que a(serv, ind) = 0,1778, la 1re vague sur les services est :",c:["+3,555","+0,1778","+20","+1,12"],a:0,e:"0,1778 × 20 ≈ 3,555. Puis les services produisent plus : 2e vague, etc.",s:"Poly D3 p.5"},
{q:"Le compte d'exploitation (tableau E) montre :",c:["Le partage de la VA entre revenus du travail et du capital","Les importations par produit","Les emplois finals","Les autoconsommations"],a:0,e:"Il n'est pas présenté en détail dans ce dossier.",s:"Poly D3 p.3"},
{q:"Dans l'équilibre de tous les produits, la colonne des marges commerciales (MC) :",c:["Totalise 0","Totalise le PIB","Est égale aux IP","Est toujours positive"],a:0,e:"Les marges se déplacent entre produits (−58 sur les services, qui les « produisent ») : au global elles s'annulent.",s:"Poly D3 p.2"},
{q:"Ex. 3 du TD : VAB 48 et production 81 pour A. Les CI de la branche A valent :",c:["33","48","129","21"],a:0,e:"CI = P − VAB = 81 − 48 = 33. (21 = total des CI en produits A, ligne ≠ colonne !)",s:"Dossier TD 3 ex.3"},
{q:"Ex. 3 du TD : la balance commerciale de A est 33 et ses exportations 36. Ses importations valent :",c:["3","69","33","−3"],a:0,e:"Balance = EX − IM, donc IM = 36 − 33 = 3.",s:"Dossier TD 3 ex.3"},
{q:"Ex. 2 du TD : C achète 20 M d'acier mais n'en utilise que 18 M. Comment enregistrer les 2 M ?",c:["En variation de stocks","En CI","En FBCF","En consommation finale"],a:0,e:"CI = ce qui est utilisé (18). Le reste est stocké.",s:"Dossier TD 3 ex.2"},
{q:"Ex. 2 du TD : la machine achetée par l'entreprise A (10 M) est :",c:["De la FBCF","Une consommation intermédiaire","Une variation de stocks","Une importation"],a:0,e:"Un bien utilisé plus d'un an dans la production.",s:"Dossier TD 3 ex.2"},
{q:"Pour quel effet de la hausse de l'énergie l'analyse du TES est-elle pertinente ?",c:["L'effet indirect (via les coûts de production)","L'effet direct sur les factures des ménages","Le bouclier tarifaire","La hausse du prix du baril"],a:0,e:"L'effet indirect passe par les CI en énergie des branches, que décrit le tableau B.",s:"Dossier TD 3 doc 2"},
{q:"La hausse des prix de l'énergie en France a commencé :",c:["Vers la mi-2021","En 2008","En mars 2020","En 2023"],a:0,e:"Reprise post-Covid, puis guerre en Ukraine en 2022.",s:"Insee Analyses n°75"},
{q:"Un « effet de second tour » désigne :",c:["L'indexation des salaires et des prix sur l'inflation, qui relance la hausse","La 2e vague du TES","Le 2e tour d'une élection","La baisse des prix après la hausse"],a:0,e:"Boucle prix-salaires qui peut amplifier les effets indirects.",s:"Dossier TD 3 doc 2"}
],
flash:[
{r:"Les 5 tableaux du TES",v:"A ressources · B CI (cœur) · C emplois finals · D compte de production · E compte d'exploitation",s:"Poly D3 p.1"},
{r:"Tableau B : que lit-on en ligne ?",v:"Pour chaque <b>produit</b>, ses débouchés en CI dans chaque branche.",s:"Poly D3 p.3"},
{r:"Tableau B : que lit-on en colonne ?",v:"Pour chaque <b>branche</b>, les CI qu'elle consomme dans chaque produit.",s:"Poly D3 p.3"},
{r:"Diagonale du tableau B",v:"Autoconsommations (ex. foin pour les bovins, composants électroniques).",s:"Poly D3 p.3"},
{r:"Prix de l'équilibre emplois-ressources",v:"<span class='f'>Prix d'acquisition = prix de base + IP − SP + MC</span>",s:"Poly D3 p.2"},
{r:"VAB",v:"<span class='f'>VAB = P (prix de base) − CI</span>",s:"Poly D3 p.3"},
{r:"PIB approche production",v:"<span class='f'>PIB = ΣVAB + IP − SP</span>",s:"Poly D3 p.6"},
{r:"PIB approche emplois",v:"<span class='f'>PIB = DC + FBCF + VS + OV + EX − IM</span>",s:"Poly D3 p.6"},
{r:"Y = C + I + G + (X − M) : que sont C, I, G ?",v:"C conso des ménages · I investissement des entreprises (et ménages) · G dépense publique (FBCF + conso des APU)",s:"Poly D3 p.7"},
{r:"Coefficient technique a(i,j)",v:"<span class='f'>a<sub>ij</sub> = CI<sub>ij</sub> / P<sub>j</sub></span>CI en produit i pour produire 1 € dans la branche j.",s:"Poly D3 p.4"},
{r:"Les 4 limites de la prévision par le TES",v:"Prix relatifs stables · rendements constants · pas de progrès technique · pas de substitution CI / travail",s:"Poly D3 p.5"},
{r:"Branche motrice / entraînée",v:"Motrice : grosses CI des autres branches (bâtiment). Entraînée : peu de CI des autres.",s:"Poly D3 p.4"},
{r:"Taux de couverture",v:"<span class='f'>Σ EX / Σ IM</span>",s:"Poly D3 p.4"},
{r:"Contribution à la VAB",v:"<span class='f'>VAB branche i / VAB totale</span>",s:"Poly D3 p.4"},
{r:"Exemple du poly : P, CI, VAB, PIB",v:"P 1 521 · CI 856 · VAB 665 · PIB 774 · ressources 1 890",s:"Poly D3 p.2–7"},
{r:"Effet direct vs indirect (énergie)",v:"Direct : factures d'énergie des ménages. Indirect : coûts de production → prix des autres biens (mesuré avec le TES).",s:"Dossier TD 3 doc 2"},
{r:"Bouclier tarifaire",v:"Gel du gaz (oct. 2021), hausse de l'électricité plafonnée, remise à la pompe : effet sur l'inflation réduit d'environ moitié.",s:"Insee Analyses n°75"}
],
oral:[
{q:"Calculez le PIB : IM 629,1 · DC 1 679,8 · FBCF 466,9 · OV 0,7 · VS −2,4 · EX 597,8",r:"PIB = DC + FBCF + VS + OV + EX − IM = 1 679,8 + 466,9 − 2,4 + 0,7 + 597,8 − 629,1 = <b>2 113,7</b>"},
{q:"Que lit-on en lignes et en colonnes dans le tableau des consommations intermédiaires du TES ?",r:"<b>Lignes</b> : pour chaque produit, ses débouchés en CI dans chaque branche. <b>Colonnes</b> : pour chaque branche, les CI qu'elle consomme dans chaque produit. Diagonale : autoconsommations. Total colonne = CI de la branche."},
{q:"À quel prix doit être valorisée la production pour assurer l'équilibre emplois-ressources ? Rappeler le calcul de ce prix.",r:"Au <b>prix d'acquisition</b> = prix de base + impôts sur les produits − subventions sur les produits (+ marges commerciales)."},
{q:"Quels sont les secteurs les plus consommateurs de biens énergétiques ?",r:"Ceux dont la <b>part des CI en énergie dans la production</b> est la plus forte (figure 1 du doc 1) : en général raffinage, chimie, métallurgie, papier-carton, verre-ciment, transports, agriculture."},
{q:"Distinguez les effets directs et indirects de la hausse des prix de l'énergie pour les ménages.",r:"<b>Direct</b> : hausse des factures d'énergie achetée par les ménages (carburant, électricité, gaz). <b>Indirect</b> : les entreprises répercutent la hausse de leurs CI en énergie sur le prix des autres biens et services. Le <b>TES</b> sert à mesurer l'effet indirect."},
{q:"Qu'est-ce que la valeur ajoutée et pourquoi le PIB passe-t-il par elle ?",r:"VAB = production (prix de base) − CI = richesse nouvelle créée. Sommer les productions compterait deux fois les CI."},
{q:"Définissez un coefficient technique et interprétez a(ind, agr) = 0,35.",r:"a<sub>ij</sub> = CI du produit i par la branche j / production de j. Pour produire 1 € de produit agricole, l'agriculture utilise 35 centimes de produits industriels."},
{q:"Quelles sont les limites de la prévision avec le TES ?",r:"Elle suppose des coefficients stables, donc : prix relatifs stables, rendements d'échelle constants, pas de progrès technique, pas de substitution entre CI et travail."},
{q:"Qu'appelle-t-on le bouclier tarifaire ?",r:"Mesures publiques pour contenir la hausse de l'énergie : gel des tarifs réglementés du gaz (octobre 2021), hausse de l'électricité plafonnée, remise à la pompe. Effet sur l'inflation réduit d'environ moitié (Insee)."},
{q:"Expliquez les effets de second tour.",r:"Les salaires et prix sont relevés pour suivre l'inflation passée → les coûts montent → les prix remontent : boucle prix-salaires qui amplifie les effets indirects."},
{q:"Tous les ménages sont-ils également touchés par la hausse de l'énergie ?",r:"Non : les plus modestes (l'énergie pèse plus dans leur budget), les ruraux (dépendance à la voiture), les logements au fioul / gaz ou mal isolés sont plus touchés."},
{q:"Quelle est la différence entre le PIB et la demande finale (ex. 2) ?",r:"Demande finale (DC + FBCF + VS) = 112 M ; PIB = 92 M. L'écart = les importations (20 M) : PIB = demande finale + EX − IM."}
],
calc:true,
pieges:[
{t:"Ligne ≠ colonne",s:"Dossier TD 3 ex.3",h:`<p>« Total des CI <b>en produits</b> A » = total de la <b>ligne</b> A. « CI <b>de la branche</b> A » = total de la <b>colonne</b> A. Ex. 3 : 21 ≠ 33.</p>`},
{t:"Le signe de la VS",s:"Dossier TD 3 exemple de quiz",h:`<p>Une VS de −2,4 se <b>soustrait</b> : 1 679,8 + 466,9 <b>− 2,4</b>… Ne la passe pas en positif.</p>`},
{t:"VAB au prix de base, PIB au prix du marché",s:"Poly D3 p.6",h:`<p>ΣVAB ≠ PIB : il faut ajouter IP et retirer SP. Exemple du poly : 665 ≠ 774.</p>`},
{t:"Les subventions se soustraient",s:"Poly D3 p.2",h:`<p>Dans le tableau A, SP est souvent noté en négatif (−5, −1). Total ressources = P + IM + IP − SP (+ MC).</p>`},
{t:"Acheté ≠ consommé",s:"Dossier TD 3 ex.2",h:`<p>Acier acheté 20 M mais utilisé 18 M : CI = 18, et 2 M en stock. Les machines et robots sont de la FBCF, pas des CI.</p>`},
{t:"Le diviseur du coefficient technique",s:"Poly D3 p.4",h:`<p>On divise par la <b>production de la branche qui consomme</b> (la colonne j), pas par les ressources du produit i.</p>`},
{t:"Balance commerciale = EX − IM",s:"Dossier TD 3 ex.3",h:`<p>Balance de A = 33 et EX = 36 → IM = 3 (pas 69 !).</p>`},
{t:"Absence de progrès technique",s:"Poly D3 p.5",h:`<p>Une question « laquelle n'est pas une limite » : le TES suppose qu'il n'y a <b>pas</b> de progrès technique. C'est cette hypothèse qui est la limite.</p>`}
]
};
