"use strict";

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const toolBar = document.querySelector(".options");
const deleteAll = document.querySelector(".delete__all");
const sort = document.querySelector("#sort");
const message = document.querySelector(".message");
const modal = document.querySelector(".modal");
const modalMessage = document.querySelector(".modal__header");
const overlay = document.querySelector(".overlay");
const btnCloseModal = document.querySelector(".btn--close-modal");
const btnShowAll = document.querySelector(".show__all");
const totalKm = document.querySelector(".total__distance");
let workoutEl;

class Workout {
  date = new Date();
  id = Date.now().toString().slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December",];
    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / this.duration;
    return this.speed;
  }
}

//////////////////////////////////////////////

// Architecture
class App {
  #map;
  #zoomLevel = 15;
  #mapEvent;
  #workouts = [];
  #markers = [];
  constructor() {
    this._getPosition();
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener(
      "click",
      this._moveToPosition.bind(this)
    );
    this._getLocalStorage();
    deleteAll.addEventListener("click", this._reset);
    sort.addEventListener("change", this._sort.bind(this));
    btnCloseModal.addEventListener("click", this._closeModal);
    btnShowAll.addEventListener("click", this._zoomOutMarkers.bind(this));
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      function () {
        this._error(
          "Could not get your location! Please check your internet connection."
        );
      }.bind(this)
    );
  }

  _loadMap(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const coords = [latitude, longitude];
    this.#map = L.map("map").setView(coords, this.#zoomLevel);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.#map);

    this.#map.on("click", this._showForm.bind(this));

    this.#workouts.forEach((work) => this._displayMap(work));
    this._zoomOutMarkers();
  }

  _zoomOutMarkers() {
    if (this.#markers.length === 0) return;
    let bounds = new L.featureGroup(this.#markers);
    this.#map.fitBounds(bounds.getBounds());
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    // Hide the message
    message.style.setProperty("display", "none");
    form.classList.remove("hidden");
    inputDistance.focus();
  }
  _hideForm() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        "";
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get input from the fields
    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    // If running, create running object
    if (type === "running")
      workout = this._createWorkout([lat, lng], "running", distance, duration);

    // If cycling, create cycling object
    if (type === "cycling")
      workout = this._createWorkout([lat, lng], "cycling", distance, duration);

    // Check if workout created
    if (workout === -1) return;

    // Add new workout to workouts array
    this.#workouts.push(workout);

    // Render new workout on map
    this._displayMap(workout);

    // Render workout in list
    this._renderWorkout(workout, form);

    // Show the toolbar
    this._toolBarSetup("open");

    // Change total distance
    this._calcTotalDistance();

    // Add the workout list in Local Storage
    this._setLocalStorage();

    // Hide the form and clear input fields

    this._hideForm();
  }

  _calcTotalDistance() {
    const totalDistance = this.#workouts.reduce(
      (accu, workout) => (accu += workout.distance),
      0
    );
    totalKm.textContent = `${totalDistance} KM`;
  }

  _createWorkout(Coords, type, distance, duration) {
    const lat = Coords[0];
    const lng = Coords[1];

    // Function to validate inputs
    const validateInput = (...inputs) =>
      inputs.every((input) => Number.isFinite(input) && input > 0);

    // If running, create object of running type
    if (type === "running") {
      let cadence;
      if (form.classList.contains("hidden")) {
        cadence = Number(
          document.querySelector(".edit__form__input--cadence").value
        );
      } else {
        cadence = Number(inputCadence.value);
      }

      // Check if valid input
      if (!validateInput(distance, duration, cadence)) {
        this._error("Input must be a positive number!");
        return -1;
      } else return new Running([lat, lng], distance, duration, cadence);
    }

    // If cycling, create cycling object
    if (type === "cycling") {
      let elevationGain;
      if (form.classList.contains("hidden")) {
        elevationGain = Number(
          document.querySelector(".edit__form__input--elevationGain").value
        );
      } else {
        elevationGain = Number(inputElevation.value);
      }
      // Check if valid input
      if (!validateInput(distance, duration, elevationGain)) {
        this._error("Input must be a positive number!");
        return -1;
      } else return new Cycling([lat, lng], distance, duration, elevationGain);
    }
  }

  _displayMap(workout) {
    const lamMarker = new L.marker(workout.coords);

    this.#markers.push(lamMarker);

    lamMarker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♀️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout, el) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description} <div>
          <button><i class="edit__btn fa fa-pencil" style="font-size:20px"></i></button>
          <button><i class="delete__btn fa fa-trash-o" style="font-size:20px"></i></button>
          </div></h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃‍♀️" : "🚴‍♀️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;
    if (workout.type === "running") {
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
        `;
    } else
      html += `
    <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
    `;

    el.insertAdjacentHTML("afterend", html);
  }

  _moveToPosition(e) {
    if (e.target.closest(".delete__btn")) {
      this._removeWorkout(e);
      return;
    }

    if (e.target.closest(".edit__btn")) {
      this._editWorkout(e);
      return;
    }
    const workoutElem = e.target.closest(".workout");
    if (!workoutElem) return;

    const workout = this.#workouts.find(
      (work) => work.id === workoutElem.dataset.id
    );
    this.#map.setView(workout.coords, this.#zoomLevel, {
      animate: true,
      pad: {
        duration: 1,
      },
    });
  }

  _removeWorkout(e) {
    const workout = e.target.closest(".workout");
    if (!workout) return;
    const index = this.#workouts.findIndex(
      (work) => work.id === workout.dataset.id
    );

    const marker = this.#markers[index];
    marker.remove();

    this.#workouts.splice(index, 1);
    this.#markers.splice(index, 1);

    if (this.#workouts.length === 0) {
      this._toolBarSetup("close");
      message.style.setProperty("display", "block");
    }
    this._setLocalStorage();
    workout.remove();
    this._calcTotalDistance();
  }

  _editWorkout(e) {
    if (document.querySelector(".edit__form")) {
      document.querySelector(".edit__form").remove();
      workoutEl.style.setProperty("display", "grid");
    }
    workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;
    const index = this.#workouts.findIndex(
      (work) => work.id === workoutEl.dataset.id
    );
    const workout = this.#workouts[index];

    const formTemplate = `
      <form onsubmit="return false;" class="form edit__form">
            <div class="form__row">
              <label class="form__label">Type</label>
              <select class="form__input form__input--type">
                <option value="running" ${
                  workout.type === "running" ? "selected" : ""
                }>Running</option>
                <option value="cycling" ${
                  workout.type === "cycling" ? "selected" : ""
                }>Cycling</option>
              </select>
            </div>
            <div class="form__row">
              <label class="form__label">Distance</label>
              <input
                type="text"
                class="form__input form__input--distance"
                value="${workout.distance}"
              />
            </div>
            <div class="form__row">
              <label class="form__label">Duration</label>
              <input
                type="text"
                class="form__input form__input--duration"
                value="${workout.duration}"
              />
            </div>
            <div class="form__row ${
              workout.type === "running" ? "" : "form__row--hidden"
            }">
              <label class="form__label">Cadence</label>
              <input
                type="text"
                class="form__input form__input--cadence edit__form__input--cadence"
                ${
                  workout.type === "running"
                    ? `value=${workout.cadence}`
                    : `placeholder="step/min"`
                }
              />
            </div>
            <div class="form__row ${
              workout.type === "cycling" ? "" : "form__row--hidden"
            }">
              <label class="form__label">Elev Gain</label>
              <input
                type="text"
                class="form__input form__input--elevation edit__form__input--elevationGain"
                ${
                  workout.type === "cycling"
                    ? `value=${workout.elevationGain}`
                    : `placeholder="meters"`
                }
              />
            </div>
            <button class="form__btn">OK</button>
          </form>
      `;
    // Hiding the existing workout element
    workoutEl.style.setProperty("display", "none");

    // Displaying the form
    workoutEl.insertAdjacentHTML("afterend", formTemplate);

    // Selecting the new form element
    const editForm = document.querySelector(".edit__form");

    // Adding the change workout type event listener
    editForm
      .querySelector(".form__input--type")
      .addEventListener("change", function () {
        editForm
          .querySelector(".form__input--elevation")
          .closest(".form__row")
          .classList.toggle("form__row--hidden");
        editForm
          .querySelector(".form__input--cadence")
          .closest(".form__row")
          .classList.toggle("form__row--hidden");
      });

    // Submitting the edited form
    editForm.addEventListener(
      "submit",
      this._submitEditedWorkout.bind(
        this,
        workout.coords,
        index,
        workout,
        workoutEl
      )
    );
  }

  _submitEditedWorkout(coords, index, prevWorkout, nextWorkout) {
    const lat = coords[0];
    const lng = coords[1];
    const editForm = document.querySelector(".edit__form");
    const inputType = editForm.querySelector(".form__input--type");
    const inputDistance = editForm.querySelector(".form__input--distance");
    const inputDuration = editForm.querySelector(".form__input--duration");
    const inputCadence = editForm.querySelector(".form__input--cadence");
    const inputElevation = editForm.querySelector(".form__input--elevation");

    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);

    let workout;

    // If running, create running object
    if (type === "running")
      workout = this._createWorkout([lat, lng], "running", distance, duration);

    // If cycling, create cycling object
    if (type === "cycling")
      workout = this._createWorkout([lat, lng], "cycling", distance, duration);

    // Check if workout created
    if (workout === -1) return;

    // Keep the previous date

    workout.date = new Date(prevWorkout.date);

    workout._setDescription();

    // Add edited workout to workouts array in the same index
    this.#workouts[index] = workout;

    // Remove the existing marker on map
    const mark = this.#markers.splice(index, 1);

    mark[0].remove();

    // Render new workout on map
    this._displayMap(workout);

    // Render workout in list
    this._renderWorkout(workout, nextWorkout);

    // Change total distance
    this._calcTotalDistance();

    // Add the workout list in Local Storage
    this._setLocalStorage();

    // Hide the form, the previous workout element
    workoutEl.remove();
    editForm.remove();
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    if (!data) return;
    this.#workouts = data;
    if (!(this.#workouts.length === 0)) {
      this._toolBarSetup("open");
      message.style.setProperty("display", "none");
    }

    this.#workouts.forEach((work) => this._renderWorkout(work, form));
    this._calcTotalDistance();
  }

  _sort() {
    const value = sort.value;

    let workouts;
    if (value === "duration") {
      workouts = this.#workouts.slice().sort((a, b) => a.duration - b.duration);
    }
    if (value === "distance") {
      workouts = this.#workouts.slice().sort((a, b) => a.distance - b.distance);
    }
    if (value === "") workouts = this.#workouts;
    document.querySelectorAll(".workout").forEach((work) => work.remove());
    workouts.forEach((work) => this._renderWorkout(work, form));
  }
  _reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }

  _error(message) {
    modalMessage.textContent = message;
    modal.classList.remove("hidden");
    overlay.classList.remove("hidden");
  }

  _closeModal() {
    modal.classList.add("hidden");
    overlay.classList.add("hidden");
  }

  _toolBarSetup(command) {
    if (command === "close") {
      toolBar.style.setProperty("display", "none");
      btnShowAll.style.setProperty("display", "none");
    }
    if (command === "open") {
      toolBar.style.setProperty("display", "flex");
      btnShowAll.style.setProperty("display", "inline");
    }
  }
}

const app = new App();

// The data we obtain from local storage is actually in the form of normal objects. So they do not inherit and cannot use any of their class methods that they inherited.
