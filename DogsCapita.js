let dogData = null; //dog data per district
let capitaData = null;

//load dogs per district
function loadDogData() {
    return d3.dsv(";", "data/hunde-wien.csv")
        .then(data => {
            return data;
        })
}

//load population data per district
function loadCapitaData() {
    return d3.dsv(";", "data/Bevölkerungsdichte_in_Wien.csv")
        .then(data => {
            return data
        })
}

function drawCapitaChart(dogsData) {

}

//load dog-data & capita-data
Promise.all([loadDogData(), loadCapitaData()])
    .then(([dogDataLoaded], capitaDataLoaded) => {
        dogData = dogDataLoaded;
        capitaData = capitaDataLoaded;

        //draw chart
        drawCapitaChart(dogData);
    })
    .catch(error => {
        console.error("Error loading data:", error);
        d3.select("#apartment-chart-title").text("Error loading data");
    });