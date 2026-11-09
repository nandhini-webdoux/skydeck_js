
"use strict";

const cityCards = document.getElementById("city-cards");
const citySearch = document.getElementById("city-search");
const suggestions = document.getElementById("search-suggestions");


const refreshBtn = document.getElementById("refresh-btn");
const celsiusBtn = document.getElementById("celsius-btn");
const fahrenheitBtn = document.getElementById("fahrenheit-btn");

const filterButtons = document.querySelectorAll(".filter-btn");
const sortSelect = document.getElementById("sort-select");
const cityCount = document.getElementById("city-count");
const lastUpdated = document.getElementById("last-updated");


const comparePickBtn = document.getElementById("compare-pick-btn");
const comparePicker = document.getElementById("compare-picker");
const compareTable = document.getElementById("compare-table");

const tripForm = document.getElementById("trip-form");
const noteCity = document.getElementById("note-city");
const travelDate = document.getElementById("travel-date");
const tripNote = document.getElementById("trip-note");
const budgetInput = document.getElementById("budget");
const notesList = document.getElementById("notes-list");
const noteCounter = document.getElementById("note-counter");




let cities = [];
let compareCityIds = [];

let currentFilter = "all";
let currentUnit = "C";

let lastRefreshTime = null;
let searchTimer = null;

const MAX_CITIES = 6;
const MAX_COMPARE = 3;

const CITY_STORAGE_KEY = "skydeckCities";
const NOTES_STORAGE_KEY = "skydeckTripNotes";




function loadCities() {
    try {
        const savedCities = JSON.parse(
            localStorage.getItem(CITY_STORAGE_KEY)
        );

        return Array.isArray(savedCities) ? savedCities : [];
    } catch (error) {
        console.error("Could not load cities:", error);
        return [];
    }
}

function saveCities() {
    localStorage.setItem(
        CITY_STORAGE_KEY,
        JSON.stringify(cities)
    );
}

function loadNotes() {
    try {
        const savedNotes = JSON.parse(
            localStorage.getItem(NOTES_STORAGE_KEY)
        );

        return Array.isArray(savedNotes) ? savedNotes : [];
    } catch (error) {
        console.error("Could not load notes:", error);
        return [];
    }
}

function saveNotes() {
    localStorage.setItem(
        NOTES_STORAGE_KEY,
        JSON.stringify(notes)
    );
}

let notes = loadNotes();



function getWeatherCondition(code) {

    if (code === 0) {
        return {
            description: "Clear sky",
            icon: "☀️",
            category: "clear"
        };
    }

    if (code === 1 || code === 2) {
        return {
            description: "Partly cloudy",
            icon: "🌤️",
            category: "cloudy"
        };
    }

    if (code === 3) {
        return {
            description: "Overcast",
            icon: "☁️",
            category: "cloudy"
        };
    }

    if ([45, 48].includes(code)) {
        return {
            description: "Foggy",
            icon: "🌫️",
            category: "cloudy"
        };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return {
            description: "Drizzle",
            icon: "🌦️",
            category: "rain"
        };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return {
            description: "Rain",
            icon: "🌧️",
            category: "rain"
        };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return {
            description: "Snow",
            icon: "❄️",
            category: "cloudy"
        };
    }

    if ([95, 96, 99].includes(code)) {
        return {
            description: "Thunderstorm",
            icon: "⛈️",
            category: "rain"
        };
    }

    return {
        description: "Unknown",
        icon: "🌡️",
        category: "cloudy"
    };
}



function convertTemperature(celsius) {

    if (currentUnit === "F") {
        return (celsius * 9 / 5) + 32;
    }

    return celsius;
}

function formatTemperature(value) {

    if (value === null || value === undefined) {
        return "--";
    }

    return Math.round(convertTemperature(value)) + "°";
}

function formatUnit() {
    return currentUnit === "C" ? "°C" : "°F";
}



async function getWeather(city) {

    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${city.latitude}` +
        `&longitude=${city.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&wind_speed_unit=kmh` +
        `&timezone=auto` +
        `&forecast_days=5`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.current || !data.daily) {
        throw new Error("Weather information is unavailable.");
    }

    return data;
}



async function searchCity() {

    const searchText = citySearch.value.trim();

    suggestions.innerHTML = "";

    if (searchText.length < 2) {
        return;
    }

    try {

        const url =
            `https://geocoding-api.open-meteo.com/v1/search` +
            `?name=${encodeURIComponent(searchText)}` +
            `&count=5&language=en&format=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("City search failed.");
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {

            suggestions.innerHTML =
                `<div class="suggestion-item">No cities found</div>`;

            return;
        }

        data.results.forEach(place => {

            const item = document.createElement("div");

            item.className = "suggestion-item";

            const cityName = document.createElement("strong");
            cityName.textContent = place.name;

            const location = document.createElement("span");

            location.textContent =
                ` ${place.admin1 ? place.admin1 + ", " : ""}` +
                `${place.country || ""}`;

            item.appendChild(cityName);
            item.appendChild(location);

            item.addEventListener("click", () => {
                addCity(place);
            });

            suggestions.appendChild(item);
        });

    } catch (error) {

        console.error("Search error:", error);

        suggestions.innerHTML =
            `<div class="suggestion-item">Unable to search. Try again.</div>`;
    }
}



async function addCity(place) {

    const cityId = String(place.id);

    const alreadyExists = cities.some(
        city => String(city.id) === cityId
    );

    if (alreadyExists) {
        alert("This city is already added.");
        suggestions.innerHTML = "";
        citySearch.value = "";
        return;
    }

    if (cities.length >= MAX_CITIES) {
        alert("You can add a maximum of 6 cities.");
        return;
    }

    const city = {
        id: cityId,
        name: place.name,
        region: place.admin1 || "",
        country: place.country || "",
        latitude: place.latitude,
        longitude: place.longitude,
        pinned: false,
        weather: null,
        loading: true,
        error: null
    };

    cities.push(city);

    saveCities();
    updateCitySelect();
    displayCities();
    updateCityCount();

    suggestions.innerHTML = "";
    citySearch.value = "";

    try {

        city.weather = await getWeather(city);
        city.loading = false;

        saveCities();

    } catch (error) {

        city.loading = false;
        city.error = error.message;

        console.error(error);
    }

    displayCities();
    updateOverview();
    updateCompareTable();
}



function displayCities() {

    cityCards.innerHTML = "";

    let visibleCities = [...cities];

    // FILTER CITIES

    if (currentFilter === "pinned") {
        visibleCities = visibleCities.filter(
            city => city.pinned
        );
    }

    if (currentFilter === "rain") {
        visibleCities = visibleCities.filter(city => {

            if (!city.weather) return false;

            const condition = getWeatherCondition(
                city.weather.current.weather_code
            );

            return condition.category === "rain" ||
                city.weather.daily.precipitation_sum[0] > 0;
        });
    }

    // SORT CITIES

    const sortValue = sortSelect.value;

    visibleCities.sort((a, b) => {

        if (sortValue === "name") {
            return a.name.localeCompare(b.name);
        }

        if (sortValue === "temperature") {
            return (b.weather?.current.temperature_2m ?? -999) -
                (a.weather?.current.temperature_2m ?? -999);
        }

        if (sortValue === "wind") {
            return (b.weather?.current.wind_speed_10m ?? -999) -
                (a.weather?.current.wind_speed_10m ?? -999);
        }

        return 0;
    });

    visibleCities.forEach(city => {

        const card = document.createElement("article");

        card.className = "weather-card";

        if (city.error) {
            card.classList.add("error-card");
        }

        if (city.weather) {
            const condition = getWeatherCondition(
                city.weather.current.weather_code
            );

            if (condition.category === "rain") {
                card.classList.add("rain-card");
            } else if (condition.category === "clear") {
                card.classList.add("sun-card");
            }
        }

        // CARD HEADER

        const header = document.createElement("div");
        header.className = "card-header";

        const titleArea = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = city.name;

        const location = document.createElement("p");
        location.className = "card-location";
        location.textContent =
            `${city.region ? city.region + ", " : ""}${city.country}`;

        titleArea.append(title, location);

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const pinButton = document.createElement("button");
        pinButton.textContent = city.pinned ? "★" : "☆";
        pinButton.classList.toggle("pinned", city.pinned);
        pinButton.title = "Pin city";

        pinButton.addEventListener("click", () => {

            city.pinned = !city.pinned;

            saveCities();
            displayCities();
        });

        const removeButton = document.createElement("button");
        removeButton.textContent = "×";
        removeButton.title = "Remove city";

        removeButton.addEventListener("click", () => {
            removeCity(city.id);
        });

        actions.append(pinButton, removeButton);
        header.append(titleArea, actions);

        card.appendChild(header);

        // LOADING CARD

        if (city.loading) {

            const loading = document.createElement("p");
            loading.className = "loading-text";
            loading.textContent = "Loading weather...";

            card.appendChild(loading);

            cityCards.appendChild(card);
            return;
        }

        // ERROR CARD

        if (city.error || !city.weather) {

            const error = document.createElement("p");
            error.className = "error-message";
            error.textContent = "Couldn't load weather.";

            const message = document.createElement("p");
            message.className = "card-location";
            message.textContent = city.error || "Weather data unavailable.";

            const retry = document.createElement("button");
            retry.className = "retry-btn";
            retry.textContent = "Retry now";

            retry.addEventListener("click", () => {
                refreshCity(city);
            });

            card.append(error, message, retry);
            cityCards.appendChild(card);
            return;
        }

        const current = city.weather.current;
        const daily = city.weather.daily;

        const condition = getWeatherCondition(
            current.weather_code
        );

        // MAIN WEATHER INFORMATION

        const main = document.createElement("div");
        main.className = "weather-main";

        const icon = document.createElement("div");
        icon.className = "weather-icon";
        icon.textContent = condition.icon;

        const temperature = document.createElement("div");
        temperature.className = "temperature";

        const tempValue = document.createElement("span");
        tempValue.textContent = formatTemperature(
            current.temperature_2m
        );

        const description = document.createElement("div");
        description.className = "weather-description";

        const conditionText = document.createElement("strong");
        conditionText.textContent = condition.description;

        const feelsLike = document.createElement("span");
        feelsLike.textContent =
            `Feels like ${formatTemperature(current.apparent_temperature)}`;

        temperature.appendChild(tempValue);
        description.append(conditionText, feelsLike);

        main.append(icon, temperature, description);

        // WEATHER DETAILS

        const details = document.createElement("div");
        details.className = "weather-details";

        details.innerHTML = `
            <div>
                <p>HUMIDITY</p>
                <strong>${Math.round(current.relative_humidity_2m)}%</strong>
            </div>

            <div>
                <p>WIND</p>
                <strong>${Math.round(current.wind_speed_10m)} km/h</strong>
            </div>

            <div>
                <p>RAIN</p>
                <strong>${daily.precipitation_sum[0]} mm</strong>
            </div>
        `;

        // FIVE DAY FORECAST

        const forecast = document.createElement("div");
        forecast.className = "forecast-list";

        daily.time.forEach((date, index) => {

            const day = document.createElement("div");
            day.className = "forecast-day";

            const dateObject = new Date(date + "T12:00:00");

            const dayName = dateObject.toLocaleDateString(
                "en-US",
                { weekday: "short" }
            );

            const forecastCondition = getWeatherCondition(
                daily.weather_code[index]
            );

            day.innerHTML = `
                <span>${dayName}</span>
                <span class="forecast-icon">${forecastCondition.icon}</span>
                <strong>${formatTemperature(daily.temperature_2m_max[index])}</strong>
                <small>${formatTemperature(daily.temperature_2m_min[index])}</small>
            `;

            forecast.appendChild(day);
        });

        card.append(main, details, forecast);

        cityCards.appendChild(card);
    });

    // ADD CITY CARD

    if (cities.length < MAX_CITIES) {

        const addCard = document.createElement("div");

        addCard.className = "add-city-card";

        addCard.innerHTML = `
            <div class="add-icon">+</div>
            <h3>Add a city</h3>
            <p>Press / to search</p>
        `;

        addCard.addEventListener("click", () => {
            citySearch.focus();
        });

        cityCards.appendChild(addCard);
    }

    updateCityCount();
}



function removeCity(cityId) {

    cities = cities.filter(
        city => String(city.id) !== String(cityId)
    );

    compareCityIds = compareCityIds.filter(
        id => String(id) !== String(cityId)
    );

    saveCities();

    updateCitySelect();
    displayCities();
    updateOverview();
    updateComparePicker();
    updateCompareTable();
}




function updateCityCount() {

    cityCount.textContent =
        `${cities.length} / ${MAX_CITIES} cities`;
}




function updateLastUpdated() {

    if (!lastRefreshTime) {
        lastUpdated.textContent = "Not updated yet";
        return;
    }

    const minutes = Math.floor(
        (Date.now() - lastRefreshTime) / 60000
    );

    if (minutes === 0) {
        lastUpdated.textContent = "Updated just now";
    } else if (minutes === 1) {
        lastUpdated.textContent = "Updated 1 min ago";
    } else {
        lastUpdated.textContent =
            `Updated ${minutes} min ago`;
    }
}




async function refreshCity(city) {

    city.loading = true;
    city.error = null;

    displayCities();

    try {

        city.weather = await getWeather(city);
        city.error = null;

        lastRefreshTime = Date.now();
        updateLastUpdated();

        saveCities();

    } catch (error) {

        city.error = error.message;
        console.error(error);

    } finally {

        city.loading = false;

        displayCities();
        updateOverview();
        updateCompareTable();
    }
}




async function refreshAll() {

    if (cities.length === 0) {
        alert("Add a city first.");
        return;
    }

    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";

    let successCount = 0;

    const results = await Promise.allSettled(
        cities.map(async city => {

            city.loading = true;
            city.error = null;

            displayCities();

            const weather = await getWeather(city);

            city.weather = weather;
            city.loading = false;

            successCount++;
        })
    );

    results.forEach((result, index) => {

        cities[index].loading = false;

        if (result.status === "rejected") {
            cities[index].error = result.reason.message;
        }
    });

    if (successCount > 0) {
        lastRefreshTime = Date.now();
        updateLastUpdated();
    }

    saveCities();

    refreshBtn.disabled = false;
    refreshBtn.textContent = "↻ Refresh all";

    displayCities();
    updateOverview();
    updateCompareTable();
}



filterButtons.forEach(button => {

    button.addEventListener("click", () => {

        filterButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        currentFilter = button.dataset.filter;

        displayCities();
    });
});



sortSelect.addEventListener("change", () => {
    displayCities();
});



celsiusBtn.addEventListener("click", () => {

    currentUnit = "C";

    celsiusBtn.classList.add("active");
    fahrenheitBtn.classList.remove("active");

    displayCities();
    updateOverview();
    updateCompareTable();
});

fahrenheitBtn.addEventListener("click", () => {

    currentUnit = "F";

    fahrenheitBtn.classList.add("active");
    celsiusBtn.classList.remove("active");

    displayCities();
    updateOverview();
    updateCompareTable();
});



function updateOverview() {

    const loadedCities = cities.filter(
        city => city.weather && !city.error
    );

    const count = loadedCities.length;

    document.getElementById("overview-count").textContent =
        `${count} of ${cities.length} cities loaded`;

    if (count === 0) {

        document.getElementById("hottest-value").textContent = "--";
        document.getElementById("coldest-value").textContent = "--";
        document.getElementById("average-value").textContent = "--";
        document.getElementById("rain-value").textContent = "--";

        document.getElementById("hottest-city").textContent = "--";
        document.getElementById("coldest-city").textContent = "--";
        document.getElementById("rain-cities").textContent = "Of 0 cities";

        updateConditionSummary([]);
        return;
    }

    const sorted = [...loadedCities].sort(
        (a, b) =>
            a.weather.current.temperature_2m -
            b.weather.current.temperature_2m
    );

    const coldest = sorted[0];
    const hottest = sorted[sorted.length - 1];

    const totalTemperature = loadedCities.reduce(
        (total, city) =>
            total + city.weather.current.temperature_2m,
        0
    );

    const average = totalTemperature / count;

    const rainCities = loadedCities.filter(city =>
        city.weather.daily.precipitation_sum[0] > 0
    );

    document.getElementById("hottest-value").textContent =
        formatTemperature(hottest.weather.current.temperature_2m) + formatUnit();

    document.getElementById("hottest-city").textContent =
        hottest.name;

    document.getElementById("coldest-value").textContent =
        formatTemperature(coldest.weather.current.temperature_2m) + formatUnit();

    document.getElementById("coldest-city").textContent =
        coldest.name;

    document.getElementById("average-value").textContent =
        formatTemperature(average) + formatUnit();

    document.getElementById("rain-value").textContent =
        rainCities.length;

    document.getElementById("rain-cities").textContent =
        `Of ${count} cities`;

    updateConditionSummary(loadedCities);
}



function updateConditionSummary(loadedCities) {

    let clearCount = 0;
    let cloudyCount = 0;
    let rainCount = 0;

    loadedCities.forEach(city => {

        const condition = getWeatherCondition(
            city.weather.current.weather_code
        );

        if (condition.category === "clear") {
            clearCount++;
        } else if (condition.category === "rain") {
            rainCount++;
        } else {
            cloudyCount++;
        }
    });

    document.getElementById("clear-count").textContent =
        clearCount;

    document.getElementById("cloudy-count").textContent =
        cloudyCount;

    document.getElementById("rain-count").textContent =
        rainCount;

    const total = loadedCities.length || 1;

    document.getElementById("clear-bar").style.width =
        `${clearCount / total * 100}%`;

    document.getElementById("cloudy-bar").style.width =
        `${cloudyCount / total * 100}%`;

    document.getElementById("rain-bar").style.width =
        `${rainCount / total * 100}%`;
}




comparePickBtn.addEventListener("click", () => {

    comparePicker.hidden = !comparePicker.hidden;

    if (!comparePicker.hidden) {
        updateComparePicker();
    }
});

function updateComparePicker() {

    comparePicker.innerHTML = "";

    if (cities.length === 0) {

        comparePicker.textContent =
            "Add cities first to compare their weather.";

        return;
    }

    cities.forEach(city => {

        const label = document.createElement("label");

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.checked = compareCityIds.includes(city.id);

        checkbox.addEventListener("change", () => {

            if (checkbox.checked) {

                if (compareCityIds.length >= MAX_COMPARE) {

                    checkbox.checked = false;

                    alert("You can compare up to 3 cities.");

                    return;
                }

                compareCityIds.push(city.id);

            } else {

                compareCityIds = compareCityIds.filter(
                    id => id !== city.id
                );
            }

            updateCompareTable();
        });

        label.appendChild(checkbox);
        label.append(city.name);

        comparePicker.appendChild(label);
    });
}




function updateCompareTable() {

    const selectedCities = cities.filter(city =>
        compareCityIds.includes(city.id) && city.weather
    );

    let heading = `
        <tr>
            <th>Metric</th>
    `;

    selectedCities.forEach(city => {
        heading += `<th>${city.name}</th>`;
    });

    heading += "</tr>";

    let rows = "";

    if (selectedCities.length === 0) {

        rows = `
            <tr>
                <td colspan="4" class="empty-message">
                    Choose cities using the button above.
                </td>
            </tr>
        `;

    } else {

        const metrics = [
            {
                label: "Temperature",
                getValue: city =>
                    formatTemperature(
                        city.weather.current.temperature_2m
                    ) + formatUnit()
            },
            {
                label: "Feels like",
                getValue: city =>
                    formatTemperature(
                        city.weather.current.apparent_temperature
                    ) + formatUnit()
            },
            {
                label: "Humidity",
                getValue: city =>
                    city.weather.current.relative_humidity_2m + "%"
            },
            {
                label: "Wind",
                getValue: city =>
                    Math.round(
                        city.weather.current.wind_speed_10m
                    ) + " km/h"
            },
            {
                label: "Rain today",
                getValue: city =>
                    city.weather.daily.precipitation_sum[0] + " mm"
            }
        ];

        metrics.forEach(metric => {

            rows += `
                <tr>
                    <td>${metric.label}</td>
            `;

            selectedCities.forEach(city => {

                rows += `
                    <td>${metric.getValue(city)}</td>
                `;
            });

            rows += "</tr>";
        });
    }

    compareTable.innerHTML = `
        <thead>${heading}</thead>
        <tbody>${rows}</tbody>
    `;
}



function updateCitySelect() {

    const selectedValue = noteCity.value;

    noteCity.innerHTML =
        `<option value="">Select a city</option>`;

    cities.forEach(city => {

        const option = document.createElement("option");

        option.value = city.id;
        option.textContent = city.name;

        noteCity.appendChild(option);
    });

    if (cities.some(city => city.id === selectedValue)) {
        noteCity.value = selectedValue;
    }
}




tripNote.addEventListener("input", () => {

    noteCounter.textContent =
        `${tripNote.value.length} / 200`;
});




tripForm.addEventListener("submit", event => {

    event.preventDefault();

    const cityId = noteCity.value;
    const date = travelDate.value;
    const note = tripNote.value.trim();
    const budget = budgetInput.value;

    if (!cityId || !date || note.length < 10) {
        alert("Please complete all required fields correctly.");
        return;
    }

    const selectedCity = cities.find(
        city => city.id === cityId
    );

    if (!selectedCity) {
        alert("Please select a valid city.");
        return;
    }

    const newNote = {
        id: Date.now(),
        city: selectedCity.name,
        date: date,
        note: note,
        budget: budget
    };

    notes.push(newNote);

    saveNotes();
    displayNotes();

    tripForm.reset();

    noteCounter.textContent = "0 / 200";

    alert("Trip note saved successfully!");
});



function displayNotes() {

    notesList.innerHTML = "";

    if (notes.length === 0) {

        notesList.textContent = "No trip notes saved yet.";

        return;
    }

    notes.forEach(note => {

        const card = document.createElement("div");
        card.className = "note-card";

        const header = document.createElement("div");
        header.className = "note-card-header";

        const title = document.createElement("strong");

        const formattedDate = new Date(
            note.date + "T12:00:00"
        ).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        });

        title.textContent =
            `${note.city} · ${formattedDate}`;

        const deleteButton = document.createElement("button");

        deleteButton.className = "delete-note";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete note";

        deleteButton.addEventListener("click", () => {
            deleteNote(note.id);
        });

        header.append(title, deleteButton);

        const description = document.createElement("p");
        description.textContent = note.note;

        card.append(header, description);

        if (note.budget) {

            const budgetText = document.createElement("p");

            budgetText.textContent =
                `Budget: ₹${Number(note.budget).toLocaleString("en-IN")}`;

            card.appendChild(budgetText);
        }

        notesList.appendChild(card);
    });
}



function deleteNote(noteId) {

    notes = notes.filter(
        note => note.id !== noteId
    );

    saveNotes();
    displayNotes();
}



citySearch.addEventListener("input", () => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(searchCity, 350);
});

citySearch.addEventListener("keydown", event => {

    if (event.key === "Escape") {
        suggestions.innerHTML = "";
    }

    if (event.key === "Enter") {

        const firstSuggestion =
            suggestions.querySelector(".suggestion-item");

        if (firstSuggestion) {
            firstSuggestion.click();
        }
    }
});

document.addEventListener("click", event => {

    if (!event.target.closest(".search-wrapper")) {
        suggestions.innerHTML = "";
    }
});



document.addEventListener("keydown", event => {

    if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement.tagName
        )
    ) {
        event.preventDefault();
        citySearch.focus();
    }
});




refreshBtn.addEventListener("click", refreshAll);



async function initializeDashboard() {

    cities = loadCities();

    // Keep the maximum city limit
    cities = cities.slice(0, MAX_CITIES);

    displayCities();
    updateCitySelect();
    updateCityCount();

    updateOverview();
    updateComparePicker();
    updateCompareTable();

    displayNotes();
    updateLastUpdated();

    // Refresh previously saved cities
    if (cities.length > 0) {
        await refreshAll();
    }
}



setInterval(() => {
    updateLastUpdated();
}, 30000);




initializeDashboard();
