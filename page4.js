/******** FIREBASE INIT ********/
firebase.initializeApp({
  apiKey: "AIzaSyCPumFid5YNTWug52q2VDtSDQTLU9REgss",
  authDomain: "flexi-tutors.firebaseapp.com",
  projectId: "flexi-tutors",
});
const db = firebase.firestore();

/******** CORE VARIABLES ********/
const candidateName = localStorage.getItem("candidateName");
const selectedSubjects = JSON.parse(localStorage.getItem("selectedSubjects") || "[]");

if (!candidateName || selectedSubjects.length === 0) {
  alert("Session expired or no subjects selected.");
  location.href = "page1.html";
}

document.getElementById("candName").textContent = candidateName;

/******** FILTER AND SHUFFLE SUBJECTS ********/
const filteredExamData = {};
selectedSubjects.forEach(s => {
  filteredExamData[s] = shuffle([...examData[s]]);
});

const subjects = Object.keys(filteredExamData);
let currentSubject = subjects[0];
let qIndex = 0;

const answers = {};
subjects.forEach(s => answers[s] = Array(filteredExamData[s].length).fill(null));

/******** SHUFFLE OPTIONS ********/
const optionOrder = {};
subjects.forEach(s => {
  optionOrder[s] = {};
  filteredExamData[s].forEach((q,i) => {
    optionOrder[s][i] = shuffle(Object.keys(q.options));
  });
});

/******** RENDER SUBJECT TABS ********/
const tabsContainer = document.getElementById("subjectTabs");
subjects.forEach(s => {
  const tab = document.createElement("div");
  tab.className = "subject-tab";
  tab.textContent = s;
  tab.onclick = () => { currentSubject = s; qIndex = 0; render(); };
  tabsContainer.appendChild(tab);
});
tabsContainer.firstChild.classList.add("active");

/******** RENDER FUNCTION ********/
function render() {
  // Highlight current subject
  document.querySelectorAll(".subject-tab").forEach(t => t.classList.remove("active"));
  [...tabsContainer.children].find(t => t.textContent === currentSubject).classList.add("active");

  // Render question
  const q = filteredExamData[currentSubject][qIndex];
  document.getElementById("questionText").textContent = `${qIndex + 1}. ${q.question}`;

  // Render options
  const optBox = document.getElementById("options");
  optBox.innerHTML = "";
  optionOrder[currentSubject][qIndex].forEach(k => {
    const btn = document.createElement("button");
    btn.className = "option-circle";
    btn.textContent = q.options[k];
    if (answers[currentSubject][qIndex] === k) btn.classList.add("selected");
    btn.onclick = () => { answers[currentSubject][qIndex] = k; render(); };
    optBox.appendChild(btn);
  });

  renderQnums();
}

/******** RENDER QUESTION NUMBERS ********/
function renderQnums() {
  const box = document.getElementById("qnums");
  box.innerHTML = "";
  filteredExamData[currentSubject].forEach((_, i) => {
    const num = document.createElement("div");
    num.className = "qnum " + (answers[currentSubject][i] ? "green" : "red");
    if (i === qIndex) num.classList.add("current");
    num.textContent = i + 1;
    num.onclick = () => { qIndex = i; render(); };
    box.appendChild(num);
  });
}

/******** NAVIGATION ********/
document.getElementById("prevBtn").onclick = () => { if(qIndex > 0){ qIndex--; render(); } };
document.getElementById("nextBtn").onclick = () => { if(qIndex < filteredExamData[currentSubject].length - 1){ qIndex++; render(); } };

/******** TIMER ********/
const totalSeconds = 20 * 60; // 20 minutes
const endTime = Date.now() + totalSeconds * 1000;
const timerEl = document.getElementById("timeText");
const timerBar = document.getElementById("timerBar");

const timerInterval = setInterval(() => {
  const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  timerEl.textContent = `00:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  timerBar.style.width = (remaining / totalSeconds * 100) + "%";
  if (remaining <= 0) autoSubmit("timeout");
}, 500);

/******** SUBMIT FUNCTION ********/
async function autoSubmit(reason) {
  clearInterval(timerInterval);
  const score = calculateScore();
  try {
    await db.collection("cbtResults").add({
      candidateName,
      subjects,
      answers,
      rawScore: score.rawScore,
      jambScore: score.jambScore,
      reason,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    location.href = "page5.html";
  } catch(err) {
    alert("Submission failed!"); console.error(err);
  }
}

document.getElementById("submitBtn").onclick = () => {
  if(confirm("Submit exam?")) autoSubmit("manual");
};

// Auto-submit on page switch
document.addEventListener("visibilitychange", () => { if(document.hidden) autoSubmit("auto"); });

/******** SCORE CALCULATION ********/
function calculateScore() {
  let raw = 0, totalQ = 0;
  subjects.forEach(s => filteredExamData[s].forEach((q,i) => {
    totalQ++;
    if(answers[s][i] === q.answer) raw++;
    else if(answers[s][i]) raw -= 0.25;
  }));
  if(raw < 0) raw = 0;
  return { rawScore: raw.toFixed(2), jambScore: Math.round((raw / totalQ) * 400) };
}

/******** TEXT-TO-SPEECH ********/
document.getElementById("volumeBtn").onclick = () => {
  const q = filteredExamData[currentSubject][qIndex];
  const opts = optionOrder[currentSubject][qIndex].map((k,i) => `Option ${i+1}: ${q.options[k]}`).join(". ");
  if("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance(`Question ${qIndex+1}: ${q.question}. ${opts}`);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
  } else alert("TTS not supported");
};

/******** CALCULATOR ********/
const calcModal = document.getElementById("calcModal");
const calcScreen = document.getElementById("calcScreen");

document.getElementById("openCalcBtn").onclick = () => { calcScreen.value=""; calcModal.style.display="flex"; };
document.querySelector(".close-calc").onclick = () => { calcModal.style.display="none"; };

document.querySelectorAll(".calc-keys button").forEach(b => {
  b.onclick = () => {
    let val = b.textContent;
    if(val === "=") {
      try{
        let exp = calcScreen.value.replace(/÷/g,"/").replace(/×/g,"*");
        calcScreen.value = Function("return " + exp)();
      } catch { calcScreen.value = "Error"; }
    } else if(val === "DEL") {
      calcScreen.value = calcScreen.value.slice(0,-1);
    } else if(val === "C") {
      calcScreen.value = "";
    } else {
      if(calcScreen.value === "Error") calcScreen.value = "";
      calcScreen.value += val;
    }
  };
});

/******** UTILITY: SHUFFLE ********/
function shuffle(array) {
  for(let i = array.length -1; i>0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/******** INIT ********/
render();