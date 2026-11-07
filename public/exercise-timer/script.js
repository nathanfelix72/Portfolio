class ExerciseTimer {
  constructor() {
    this.currentRoutine = null;
    this.currentExerciseIndex = 0;
    this.timeRemaining = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.timer = null;
    this.soundEnabled = true;

    this.currentExercises = [];
    this.savedRoutines = [];
    this.editingRoutineId = null;
    this.editingExerciseId = null;

    // Wake Lock API for keeping screen awake
    this.wakeLock = null;
    this.wakeLockSupported = "wakeLock" in navigator;

    this.initializeElements();
    this.bindEvents();
    this.loadRoutines(); // Load routines from localStorage
    this.audioContext = null;
    this.initializeAudio();
  }

  initializeElements() {
    // Builder elements
    this.routineNameInput = document.getElementById("routine-name");
    this.exerciseNameInput = document.getElementById("exercise-name");
    this.exerciseDurationInput = document.getElementById("exercise-duration");
    this.exerciseTypeSelect = document.getElementById("exercise-type");
    this.addExerciseBtn = document.getElementById("add-exercise");
    this.exerciseList = document.getElementById("exercise-list");
    this.saveRoutineBtn = document.getElementById("save-routine");
    this.clearRoutineBtn = document.getElementById("clear-routine");
    this.savedRoutinesContainer = document.getElementById("saved-routines");

    // Timer elements
    this.builderSection = document.getElementById("builder-section");
    this.routinesSection = document.getElementById("routines-section");
    this.timerSection = document.getElementById("timer-section");
    this.routineTitle = document.getElementById("routine-title");
    this.backToRoutinesBtn = document.getElementById("back-to-routines");
    this.currentExerciseName = document.getElementById("current-exercise-name");
    this.exerciseTypeBadge = document.getElementById("exercise-type-badge");
    this.timeRemainingDisplay = document.getElementById("time-remaining");
    this.nextExerciseName = document.getElementById("next-exercise-name");
    this.currentStep = document.getElementById("current-step");
    this.totalSteps = document.getElementById("total-steps");
    this.overallProgress = document.getElementById("overall-progress");
    this.startPauseBtn = document.getElementById("start-pause-btn");
    this.skipBtn = document.getElementById("skip-btn");
    this.resetBtn = document.getElementById("reset-btn");
    this.soundEnabledCheckbox = document.getElementById("sound-enabled");
    this.wakeLockStatus = document.getElementById("wake-lock-status");
    this.progressRingCircle = document.querySelector(".progress-ring-circle");
    this.timerCircle = document.querySelector(".timer-circle");
    this.timerText = document.querySelector(".timer-text");
  }

  bindEvents() {
    this.addExerciseBtn.addEventListener("click", () => this.addExercise());
    this.saveRoutineBtn.addEventListener("click", () => this.saveRoutine());
    this.clearRoutineBtn.addEventListener("click", () =>
      this.clearCurrentRoutine()
    );
    this.backToRoutinesBtn.addEventListener("click", () =>
      this.showRoutinesList()
    );
    this.startPauseBtn.addEventListener("click", () => this.toggleTimer());
    this.skipBtn.addEventListener("click", () => this.skipExercise());
    this.resetBtn.addEventListener("click", () => this.resetTimer());
    this.soundEnabledCheckbox.addEventListener("change", (e) => {
      this.soundEnabled = e.target.checked;
    });

    // Quick break buttons
    document.querySelectorAll(".break-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const duration = parseInt(e.target.dataset.duration);
        this.addQuickBreak(duration);
      });
    });

    // Enter key support for adding exercises
    this.exerciseNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.exerciseDurationInput.focus();
    });
    this.exerciseDurationInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addExercise();
    });

    // Handle visibility change to re-acquire wake lock if needed
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.isRunning && this.wakeLockSupported) {
        // Re-acquire wake lock when returning to the page while timer is running
        this.requestWakeLock();
      }
    });
  }

  async initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    } catch (error) {
      console.log("Audio context not available");
    }
  }

  playBeep(frequency = 800, duration = 200) {
    if (!this.soundEnabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration / 1000
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }

  async requestWakeLock() {
    if (!this.wakeLockSupported) {
      console.log("Wake Lock API not supported");
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      console.log("Screen wake lock acquired");

      // Show wake lock status
      if (this.wakeLockStatus) {
        this.wakeLockStatus.style.display = "inline-block";
      }

      this.wakeLock.addEventListener("release", () => {
        console.log("Screen wake lock released");
        // Hide wake lock status when released
        if (this.wakeLockStatus) {
          this.wakeLockStatus.style.display = "none";
        }
      });
    } catch (err) {
      console.error("Failed to acquire wake lock:", err);
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log("Screen wake lock released manually");

        // Hide wake lock status
        if (this.wakeLockStatus) {
          this.wakeLockStatus.style.display = "none";
        }
      } catch (err) {
        console.error("Failed to release wake lock:", err);
      }
    }
  }

  // Helper method to find next actual exercise (not break or prepare)
  getNextExercise(currentIndex) {
    for (
      let i = currentIndex + 1;
      i < this.currentRoutine.exercises.length;
      i++
    ) {
      const exercise = this.currentRoutine.exercises[i];
      if (exercise.type === "exercise") {
        return exercise;
      }
    }
    return null;
  }

  // Helper method to get current exercise number (not breaks/prepare)
  getCurrentExerciseNumber(currentIndex) {
    let count = 0;
    for (let i = 0; i <= currentIndex; i++) {
      if (
        this.currentRoutine.exercises[i] &&
        this.currentRoutine.exercises[i].type === "exercise"
      ) {
        count++;
      }
    }
    return count;
  }

  // Helper method to count completed exercises (not breaks/prepare)
  getCompletedExerciseCount(currentIndex) {
    let count = 0;
    for (let i = 0; i < currentIndex; i++) {
      if (
        this.currentRoutine.exercises[i] &&
        this.currentRoutine.exercises[i].type === "exercise"
      ) {
        count++;
      }
    }
    return count;
  }

  // Helper method to get total exercise count
  getTotalExerciseCount() {
    return this.currentRoutine.exercises.filter((ex) => ex.type === "exercise")
      .length;
  }

  addExercise() {
    const name = this.exerciseNameInput.value.trim();
    const duration = parseInt(this.exerciseDurationInput.value);
    const type = this.exerciseTypeSelect.value;

    if (!name || !duration || duration <= 0) {
      alert("Please enter a valid exercise name and duration.");
      return;
    }

    if (this.editingExerciseId) {
      // Edit existing exercise
      const exerciseIndex = this.currentExercises.findIndex(
        (ex) => ex.id === this.editingExerciseId
      );
      if (exerciseIndex !== -1) {
        this.currentExercises[exerciseIndex] = {
          ...this.currentExercises[exerciseIndex],
          name,
          duration,
          type,
        };
      }
    } else {
      // Add new exercise
      const exercise = {
        id: Date.now(),
        name,
        duration,
        type,
      };
      this.currentExercises.push(exercise);
    }

    this.updateExerciseList();
    this.clearExerciseForm();
  }

  clearExerciseForm() {
    this.exerciseNameInput.value = "";
    this.exerciseDurationInput.value = "";
    this.exerciseTypeSelect.value = "exercise";
    this.exerciseNameInput.focus();
    this.editingExerciseId = null;
    this.addExerciseBtn.textContent = "Add Exercise";
  }

  addQuickBreak(duration) {
    const exercise = {
      id: Date.now(),
      name: `Break (${duration}s)`,
      duration: duration,
      type: "break",
    };

    this.currentExercises.push(exercise);
    this.updateExerciseList();
  }

  updateExerciseList() {
    if (this.currentExercises.length === 0) {
      this.exerciseList.innerHTML =
        '<div class="empty-state"><h3>No exercises added</h3><p>Add exercises to build your routine</p></div>';
      return;
    }

    this.exerciseList.innerHTML = this.currentExercises
      .map(
        (exercise, index) => `
            <div class="exercise-item ${exercise.type}" draggable="true" data-id="${exercise.id}" data-index="${index}">
                <span class="drag-handle">⋮⋮</span>
                <div class="exercise-info">
                    <div class="exercise-name">${exercise.name}</div>
                    <div class="exercise-duration">${this.formatTime(exercise.duration)}</div>
                </div>
                <span class="exercise-type-label ${exercise.type}">${exercise.type}</span>
                <div class="exercise-actions">
                    <button class="edit-exercise" onclick="timer.editExercise(${exercise.id})">Edit</button>
                    <button class="remove-exercise" onclick="timer.removeExercise(${exercise.id})">Remove</button>
                </div>
            </div>
        `
      )
      .join("");

    this.setupDragAndDrop();
  }

  removeExercise(id) {
    this.currentExercises = this.currentExercises.filter(
      (exercise) => exercise.id !== id
    );
    this.updateExerciseList();
  }

  editExercise(id) {
    const exercise = this.currentExercises.find((ex) => ex.id === id);
    if (!exercise) return;

    this.exerciseNameInput.value = exercise.name;
    this.exerciseDurationInput.value = exercise.duration;
    this.exerciseTypeSelect.value = exercise.type;
    this.editingExerciseId = id;
    this.addExerciseBtn.textContent = "Update Exercise";
    this.exerciseNameInput.focus();
  }

  setupDragAndDrop() {
    const exerciseItems = this.exerciseList.querySelectorAll(".exercise-item");

    exerciseItems.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", e.target.dataset.id);
        e.target.classList.add("dragging");
      });

      item.addEventListener("dragend", (e) => {
        e.target.classList.remove("dragging");
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        const draggingItem = this.exerciseList.querySelector(".dragging");
        if (draggingItem !== item) {
          item.classList.add("drag-over");
        }
      });

      item.addEventListener("dragleave", (e) => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");

        const draggedId = parseInt(e.dataTransfer.getData("text/plain"));
        const targetId = parseInt(item.dataset.id);

        if (draggedId !== targetId) {
          this.reorderExercises(draggedId, targetId);
        }
      });
    });
  }

  reorderExercises(draggedId, targetId) {
    const draggedIndex = this.currentExercises.findIndex(
      (ex) => ex.id === draggedId
    );
    const targetIndex = this.currentExercises.findIndex(
      (ex) => ex.id === targetId
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedExercise = this.currentExercises.splice(draggedIndex, 1)[0];
    this.currentExercises.splice(targetIndex, 0, draggedExercise);

    this.updateExerciseList();
  }

  async saveRoutine() {
    const routineName = this.routineNameInput.value.trim();

    if (!routineName) {
      alert("Please enter a routine name.");
      return;
    }

    if (this.currentExercises.length === 0) {
      alert("Please add at least one exercise to the routine.");
      return;
    }

    const routineData = {
      name: routineName,
      exercises: this.currentExercises.map((ex) => ({
        name: ex.name,
        duration: ex.duration,
        type: ex.type,
      })),
    };

    try {
      if (this.editingRoutineId) {
        // Edit existing routine
        await this.updateRoutineInAPI(this.editingRoutineId, routineData);
        alert("Routine updated successfully!");
      } else {
        // Create new routine
        await this.saveRoutineToAPI(routineData);
        alert("Routine saved successfully!");
      }

      await this.loadRoutines();
      this.clearCurrentRoutine();
    } catch (error) {
      alert("Error saving routine: " + error.message);
    }
  }

  clearCurrentRoutine() {
    this.currentExercises = [];
    this.routineNameInput.value = "";
    this.editingRoutineId = null;
    this.saveRoutineBtn.textContent = "Save Routine";
    this.updateExerciseList();
  }

  editRoutine(id) {
    const routine = this.savedRoutines.find((r) => r.id === id);
    if (!routine) return;

    this.routineNameInput.value = routine.name;
    this.currentExercises = [...routine.exercises];
    this.editingRoutineId = id;
    this.saveRoutineBtn.textContent = "Update Routine";
    this.updateExerciseList();

    // Scroll to top
    document
      .getElementById("builder-section")
      .scrollIntoView({ behavior: "smooth" });
  }

  loadRoutines() {
    try {
      const raw = localStorage.getItem("exercise-timer-routines");
      this.savedRoutines = raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Error loading routines:", error);
      this.savedRoutines = [];
    }
    this.updateSavedRoutinesDisplay();
  }

  persistRoutines() {
    localStorage.setItem(
      "exercise-timer-routines",
      JSON.stringify(this.savedRoutines)
    );
  }

  async saveRoutineToAPI(routineData) {
    const id = Date.now();
    const totalDuration = routineData.exercises.reduce(
      (sum, ex) => sum + ex.duration,
      0
    );
    const now = new Date().toISOString();
    const routine = {
      id,
      name: routineData.name,
      totalDuration,
      createdAt: now,
      updatedAt: now,
      exercises: routineData.exercises.map((ex, index) => ({
        ...ex,
        id: id + index + 1,
        order_index: index,
      })),
    };
    this.savedRoutines.unshift(routine);
    this.persistRoutines();
    return routine;
  }

  async updateRoutineInAPI(id, routineData) {
    const index = this.savedRoutines.findIndex((routine) => routine.id === id);
    if (index === -1) {
      throw new Error("Routine not found");
    }

    const totalDuration = routineData.exercises.reduce(
      (sum, ex) => sum + ex.duration,
      0
    );
    const updated = {
      ...this.savedRoutines[index],
      name: routineData.name,
      totalDuration,
      updatedAt: new Date().toISOString(),
      exercises: routineData.exercises.map((ex, order) => ({
        ...ex,
        id: typeof ex.id === "number" ? ex.id : Date.now() + order,
        order_index: order,
      })),
    };

    this.savedRoutines[index] = updated;
    this.persistRoutines();
    return updated;
  }

  async deleteRoutineFromAPI(id) {
    this.savedRoutines = this.savedRoutines.filter(
      (routine) => routine.id !== id
    );
    this.persistRoutines();
    return { message: "Routine deleted successfully" };
  }

  updateSavedRoutinesDisplay() {
    if (this.savedRoutines.length === 0) {
      this.savedRoutinesContainer.innerHTML =
        '<div class="empty-state"><h3>No saved routines</h3><p>Create and save your first routine to get started</p></div>';
      return;
    }

    this.savedRoutinesContainer.innerHTML = this.savedRoutines
      .map(
        (routine) => `
            <div class="routine-card">
                <h3>${routine.name}</h3>
                <div class="routine-summary">
                    ${routine.exercises.length} exercises • ${this.formatTime(routine.totalDuration)} total
                </div>
                <div class="routine-card-actions">
                    <button class="start-routine" onclick="timer.startRoutine(${routine.id})">Start Routine</button>
                    <button class="edit-routine" onclick="timer.editRoutine(${routine.id})">Edit</button>
                    <button class="delete-routine" onclick="timer.deleteRoutine(${routine.id})">Delete</button>
                </div>
            </div>
        `
      )
      .join("");
  }

  async deleteRoutine(id) {
    if (confirm("Are you sure you want to delete this routine?")) {
      try {
        await this.deleteRoutineFromAPI(id);
        await this.loadRoutines();
      } catch (error) {
        alert("Error deleting routine: " + error.message);
      }
    }
  }

  startRoutine(id) {
    const routine = this.savedRoutines.find((r) => r.id === id);
    if (!routine) return;

    this.currentRoutine = routine;
    this.currentExerciseIndex = 0;
    this.isRunning = false;
    this.isPaused = false;

    this.showTimerView();
    this.updateTimerDisplay();
    this.resetProgressRing();
  }

  showTimerView() {
    this.builderSection.style.display = "none";
    this.routinesSection.style.display = "none";
    this.timerSection.style.display = "block";

    this.routineTitle.textContent = this.currentRoutine.name;
    // Count only actual exercises (not breaks or prepare)
    const exerciseCount = this.currentRoutine.exercises.filter(
      (ex) => ex.type === "exercise"
    ).length;
    this.totalSteps.textContent = exerciseCount;
  }

  showRoutinesList() {
    this.timerSection.style.display = "none";
    this.builderSection.style.display = "block";
    this.routinesSection.style.display = "block";

    this.stopTimer();
    this.currentRoutine = null;
  }

  updateTimerDisplay() {
    if (!this.currentRoutine) return;

    const currentExercise =
      this.currentRoutine.exercises[this.currentExerciseIndex];
    const nextExercise =
      this.currentRoutine.exercises[this.currentExerciseIndex + 1];

    if (!this.isRunning) {
      this.timeRemaining = currentExercise.duration;
    }

    // Update current exercise info
    this.currentExerciseName.textContent = currentExercise.name;
    this.exerciseTypeBadge.textContent = currentExercise.type.toUpperCase();
    this.exerciseTypeBadge.className = `exercise-type-badge ${currentExercise.type}`;

    // Update time display
    this.timeRemainingDisplay.textContent = this.formatTime(this.timeRemaining);

    // Update next exercise (only show actual exercises, skip breaks)
    const nextActualExercise = this.getNextExercise(this.currentExerciseIndex);
    if (nextActualExercise) {
      this.nextExerciseName.textContent = nextActualExercise.name;
    } else {
      this.nextExerciseName.textContent = "Finished!";
    }

    // Update progress (only count actual exercises)
    const currentExerciseNumber = this.getCurrentExerciseNumber(
      this.currentExerciseIndex
    );
    const totalExercises = this.getTotalExerciseCount();
    const completedExercises = this.getCompletedExerciseCount(
      this.currentExerciseIndex
    );

    // Show current exercise number if we're on an exercise, otherwise show completed count
    if (currentExercise.type === "exercise") {
      this.currentStep.textContent = currentExerciseNumber;
    } else {
      this.currentStep.textContent = completedExercises;
    }

    const progressPercent =
      totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
    this.overallProgress.style.width = `${progressPercent}%`;

    // Update progress ring
    this.updateProgressRing(currentExercise.duration, this.timeRemaining);

    // Update button state
    this.startPauseBtn.textContent = this.isRunning ? "Pause" : "Start";
    this.startPauseBtn.className = this.isRunning
      ? "control-btn primary pause"
      : "control-btn primary";
  }

  updateProgressRing(totalTime, timeRemaining) {
    const circumference = 2 * Math.PI * 90; // radius = 90
    const progress = (totalTime - timeRemaining) / totalTime;
    const offset = circumference - progress * circumference;

    this.progressRingCircle.style.strokeDashoffset = offset;
    this.progressRingCircle.classList.toggle("active", this.isRunning);
  }

  resetProgressRing() {
    const circumference = 2 * Math.PI * 90;
    this.progressRingCircle.style.strokeDashoffset = circumference;
    this.progressRingCircle.classList.remove("active");
  }

  toggleTimer() {
    if (!this.currentRoutine) return;

    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    if (!this.currentRoutine) return;

    // Resume audio context if needed
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    // Request wake lock to keep screen on
    this.requestWakeLock();

    this.isRunning = true;
    this.isPaused = false;

    this.timer = setInterval(() => {
      this.timeRemaining--;
      this.updateTimerDisplay();

      // Warning beeps in last 3 seconds
      if (this.timeRemaining <= 3 && this.timeRemaining > 0) {
        this.playBeep(1000, 150);
        this.timerText.classList.add("warning");
        this.timerCircle.classList.add("pulse");
      } else {
        this.timerText.classList.remove("warning");
        this.timerCircle.classList.remove("pulse");
      }

      if (this.timeRemaining <= 0) {
        this.completeCurrentExercise();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    this.isPaused = true;
    this.stopTimer();
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.timerText.classList.remove("warning");
    this.timerCircle.classList.remove("pulse");

    // Release wake lock when timer stops
    this.releaseWakeLock();
  }

  completeCurrentExercise() {
    this.stopTimer();

    // Play completion sound
    this.playBeep(1200, 300);

    // Move to next exercise
    this.currentExerciseIndex++;

    if (this.currentExerciseIndex >= this.currentRoutine.exercises.length) {
      this.completeRoutine();
    } else {
      // Auto-start next exercise after a brief pause
      setTimeout(() => {
        this.updateTimerDisplay();
        this.startTimer();
      }, 1000);
    }
  }

  completeRoutine() {
    // Play completion sound sequence
    setTimeout(() => this.playBeep(800, 200), 0);
    setTimeout(() => this.playBeep(1000, 200), 200);
    setTimeout(() => this.playBeep(1200, 400), 400);

    this.overallProgress.style.width = "100%";
    this.currentExerciseName.textContent = "Routine Complete!";
    this.exerciseTypeBadge.textContent = "FINISHED";
    this.exerciseTypeBadge.className = "exercise-type-badge";
    this.timeRemainingDisplay.textContent = "00:00";
    this.nextExerciseName.textContent = "Great job!";

    this.startPauseBtn.textContent = "Start";
    this.startPauseBtn.className = "control-btn primary";

    alert("Congratulations! You completed your routine!");
  }

  skipExercise() {
    if (
      !this.currentRoutine ||
      this.currentExerciseIndex >= this.currentRoutine.exercises.length
    )
      return;

    this.stopTimer();
    this.completeCurrentExercise();
  }

  resetTimer() {
    this.stopTimer();
    this.currentExerciseIndex = 0;
    this.updateTimerDisplay();
    this.resetProgressRing();
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}

// Initialize the timer app
const timer = new ExerciseTimer();
