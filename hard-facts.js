//get number of dogs in vienna + ratio of mixed-breeds
d3.dsv(";", "data/hunde-wien.csv").then(data => {
    const totalDogs = d3.sum(data, d => +d.Anzahl);

    d3.select("#dogs-count")
      .text(totalDogs.toLocaleString());
    
    //count only dogs that are not pure-bred
    const mixedDogs = d3.sum(data, d => {
        const breed = d["Dog Breed"] || "";
        if (breed.includes("/") || 
            breed.includes("Mischling") || 
            breed === "Unbekannt") {
            return +d.Anzahl;
        }
        return 0;
    });
    
    //get ratio
    const mixedRatio = (mixedDogs / totalDogs) * 100;

    d3.select("#breed-ratio")
      .text(mixedRatio.toFixed(2).toLocaleString());
});

//get global dog Space in vienna
d3.text("data/tab_4.3.2_freizeitundsport_.csv").then(text => {
    const rows = d3.tsvParseRows(text);
    const cols = rows[5][0].split(";");
    const dogSpace = Number(cols[4].replace(",", ".")) + Number(cols[6].replace(",", "."));
    d3.select("#dog-space-count")
      .text(Math.round(dogSpace).toLocaleString());

});

//get average apartment space in vienna
d3.text("data/tab-2-2-3-wohnu.csv").then(text => {
    const rows = d3.tsvParseRows(text);
    const cols = rows[5][0].split(";");
    const livingSpace = Number(
      cols[6]);    
    d3.select("#living-space-count")
      .text(Math.round(livingSpace).toLocaleString());

});