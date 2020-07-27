---
title: "Datsets for cut optimization"
---

# Seturi de date

Sarcina de optimzare a tăieturilor constă în găsirea tăieturilor rectangulare optime date o placă și o listă de defecte.
Prin tăieturi _optime_ înțelegem că tăieturi care
_(i)_ acoperă cât mai mult din placă și
_(ii)_ îndeplinesc o serie de constrângeri pre-specificate de utilizator (de exemplu, dimensiune minimă sau număr maxim de defecte conținute de fiecare tăietură).

Dată această formulare abstractă a problemei, observăm că putem lucra pe date de intrare relativ simple:
o placă poate fi reprezentată ca un dreptunghi, iar defectele ca o listă de dretpunghiuri (de dimensiuni posibil mai mici decât placa).
Din acest motiv, am considerat două tipuri de date: sintetice și naturale.
Datele sintetice se referă la faptul că acestea generate în mod artificial și aleator,
iar datele naturale sunt extrase din baze de date cu imagini naturale și adnoate.
Aceste două tipuri sunt descrise în continuare, fiecare în parte.

## Date sintetice

Datele sintetice constă în generarea aleatoare de intrări (placă și defecte) pentru problema de optimizare.
Cum placa și defectele sunt reprezentate ca dreptunghiuri, procesul rezultă în generarea a $n + 1$ dreptunghiuri;
acestea sunt obținute astfel:
- alegem dimensiunea plăcii (lățime $h$ și lungime $w$)
- alegem un număr $n$ de defecte
- pentru fiecare defect $i$, alegem o poziție pe placă ($x_i, y_i$) și dimensiunea sa (lățime $h_i$ și lungime $w_i$).

Pentru fiecare din aceste caracteristici putem alege diferite distribuții.
În primele experimente am considerat următoarele distribuții:

$$
\begin{aligned}
w &\sim \mathcal{N}(w_{\textsf{FAS}}, \sigma^2) &h &\sim \mathcal{N}(h_{\textsf{FAS}}, \sigma^2) & \;\;\; \text{\color{gray} dimensiuni placă} \\
n &\sim \mathrm{Poi}(7) &&& \;\;\; \text{\color{gray} număr defecte} \\
x_i &\sim \mathcal{U}(0, h) &y_i &\sim \mathcal{U}(0, w) & \;\;\; \text{\color{gray} locație defect} \\
w_i &\sim \mathcal{N}\left(\frac{h}{5}, \frac{h^2}{10^2}\right) &h_i &\sim \mathcal{N}\left(\frac{h}{10}, \frac{h^2}{10^2}\right) & \;\;\; \text{\color{gray} dimensiune defect} \\
\end{aligned}
$$

unde 
- $\mathcal{N}(\mu, \sigma^2)$ reprezintă o distribuție normală (Gaussiană) cu medie $\mu$ și varianță $\sigma^2$
- $\mathcal{U}(a, b)$ reprezintă o distribuție uniformă pe intervalul $\left[a, b\right]$.
- $\mathrm{Poi}(\lambda)$ reprezintă o distrbuție de tip Poisson cu medie $\lambda$.

În figura 1, sunt reprezentate exemple de plăci generate conform distribuției definite mai sus.

Avantajele datelor sintetice sunt că acestea sunt ușor de obținut și pot fi generate cantități infinite.
Principalul dezvantaj al acestui de tip de date e că distribuțiile utilizate pot fi prea diferite față de datele reale.

## Date naturale

Prin date naturale înțelegem faptul că informațiile despre placă și defecte din seturi sunt extrase din date naturale, bazate pe imagini și defecte adnotate manual.
În particular, noi am folosit baza de date oferită de cei de la Universitatea din Oulu.
Aceasta conține 418 plăci fiecare având patru poze (corespunzând celor patru pârți: sus, jos, stânga, dreapta)
și adnotată cu 41 tipuri de defecte sub formă de dreptunghiuri.

Câteva imagini din setul lor de date sunt prezentate în figura 2,
 iar în urma prelucrării renunțăm la informația de aspect și rămânem doar cu defectele și poziționarea lor (vezi figura 3).

Avantajele și dezavantajele acestui tip de date sunt în oglindă față de ce am observat la datele de tip sintetic.
Avantajul este că distrbuția datelor (dimensiunea plăcilor, locația și dimensiuna defectelor) e probabil mai apropiată de ce vom întâlni îm practică.
Dezavantajul este cantiatea mai redusă de plăci.

Ca și în cazul datelor sintetice distribuția dimensiunii plăcii e inspirată din manulalul evaluatorului NHLA.
Mai precis, am ales lățimea plăcii (latura cea scurtă) să corespundă aproximativ valoarii minime necesare gradului _first and second_ (FAS, cel mai bun grad ce poate fi acordat unei plăci) – 6 inch lățime și 8 foot lungime.
Luând în calcul dimensiunea pozelor, am presupus că acestea au fost capturate la o rezoluție de 0.7 mm / pixel.
Astfel obținem lățimii între și ; și lungimii între și .
Raportul de aspect (aspect ratio) pentru plăcile este de .
În timp ce dimenisunile minime pentru gradare au raport de aspect în jurul valorii.
Pentru acest motiv, am tăiat plăcile din baza de date Salum în sub-bucăți:
trei sub-plăci de dimensiuni egale.
