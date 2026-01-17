/******** FIREBASE ********/
firebase.initializeApp({
  apiKey: "AIzaSyCPumFid5YNTWug52q2VDtSDQTLU9REgss",
  authDomain: "flexi-tutors.firebaseapp.com",
  projectId: "flexi-tutors",
});
const db = firebase.firestore();

/******** CORE ********/
const candidateName = localStorage.getItem("candidateName");
const selectedSubjects = JSON.parse(localStorage.getItem("selectedSubjects"));

if (!candidateName || !selectedSubjects) {
  alert("Session expired");
  location.href = "page1.html";
}

document.getElementById("candName").textContent = candidateName;

/******** FILTER SUBJECTS ********/
const filteredExamData = {};
selectedSubjects.forEach(s => filteredExamData[s] = shuffle([...examData[s]]));
const subjects = Object.keys(filteredExamData);
let currentSubject = subjects[0];
let qIndex = 0;

/******** ANSWERS ********/
const answers = {};
subjects.forEach(s => answers[s] = Array(filteredExamData[s].length).fill(null));

/******** SHUFFLE OPTIONS ********/
const optionOrder = {};
subjects.forEach(s => {
  optionOrder[s] = {};
  filteredExamData[s].forEach((q,i)=>{
    optionOrder[s][i] = shuffle(Object.keys(q.options));
  });
});

/******** SUBJECT TABS ********/
const tabs = document.getElementById("subjectTabs");
subjects.forEach(s=>{
  const t = document.createElement("div");
  t.className = "subject-tab";
  t.textContent = s;
  t.onclick = () => { currentSubject = s; qIndex = 0; render(); };
  tabs.appendChild(t);
});
tabs.firstChild.classList.add("active");

/******** RENDER ********/
function render(){
  // Active tab
  document.querySelectorAll(".subject-tab").forEach(t=>t.classList.remove("active"));
  [...tabs.children].find(t=>t.textContent===currentSubject).classList.add("active");

  // Question text
  const q = filteredExamData[currentSubject][qIndex];
  document.getElementById("questionText").textContent = `${qIndex+1}. ${q.question}`;

  // Options
  const optBox = document.getElementById("options");
  optBox.innerHTML = "";
  optionOrder[currentSubject][qIndex].forEach(k=>{
    const b = document.createElement("button");
    b.className = "option-circle";
    b.textContent = q.options[k];
    if(answers[currentSubject][qIndex]===k) b.classList.add("selected");
    b.onclick = () => { answers[currentSubject][qIndex] = k; render(); };
    optBox.appendChild(b);
  });

  // Question numbers
  const box = document.getElementById("qnums");
  box.innerHTML = "";
  filteredExamData[currentSubject].forEach((_,i)=>{
    const d = document.createElement("div");
    d.className = "qnum "+(answers[currentSubject][i]?"green":"red");
    if(i===qIndex) d.classList.add("current");
    d.textContent = i+1;
    d.onclick = () => { qIndex=i; render(); };
    box.appendChild(d);
  });
}

/******** NAV ********/
prevBtn.onclick = () => { if(qIndex>0){ qIndex--; render(); submit("auto"); } };
nextBtn.onclick = () => { if(qIndex<filteredExamData[currentSubject].length-1){ qIndex++; render(); submit("auto"); } };

/******** TIMER ********/
const total = 20*60;
const endTime = Date.now() + total*1000;
const timer = setInterval(()=>{
  const left = Math.max(0, Math.floor((endTime - Date.now())/1000));
  timeText.textContent = `00:${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;
  timerBar.style.width = (left/total)*100 + "%";
  if(left <= 0) submit("timeout");
},500);

/******** SUBMIT ********/
window.examSubmitted = false; // flag to prevent multiple submissions
async function submit(reason){
  if(window.examSubmitted) return;
  window.examSubmitted = true;

  clearInterval(timer);

  const score = calculateScore();

  try {
    await db.collection("cbtResults").add({
      candidateName,
      subjects,
      answers,
      rawScore: score.rawScore,
      jambScore: score.jambScore,
      reason,
      time: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(err) {
    console.error("Submission failed:", err);
  }

  location.href = "page5.html";
}
submitBtn.onclick = () => confirm("Submit exam?") && submit("manual");

/******** AUTO-SUBMIT ON PAGE SWITCH ********/
document.addEventListener("visibilitychange", () => {
  if(document.hidden) submit("auto");
});

/******** SCORE CALCULATION ********/
function calculateScore(){
  let raw=0,total=0;
  subjects.forEach(s => filteredExamData[s].forEach((q,i)=>{
    total++;
    if(answers[s][i] === q.answer) raw++;
    else if(answers[s][i]) raw -= 0.25;
  }));
  return { rawScore: raw.toFixed(2), jambScore: Math.round((raw/total)*400) };
}

/******** TEXT TO SPEECH ********/
volumeBtn.onclick = () => {
  const q = filteredExamData[currentSubject][qIndex];
  const opts = optionOrder[currentSubject][qIndex].map((k,i)=>`Option ${i+1}: ${q.options[k]}`).join(". ");
  if("speechSynthesis" in window){
    const u = new SpeechSynthesisUtterance(`Question ${qIndex+1}. ${q.question}. ${opts}`);
    u.lang = "en-US";
    speechSynthesis.speak(u);
  } else alert("TTS not supported");
};

/******** CALCULATOR ********/
openCalcBtn.onclick = () => calcModal.style.display = "flex";
document.querySelector(".close-calc").onclick = () => calcModal.style.display = "none";

document.querySelectorAll(".calc-keys button").forEach(b=>{
  b.onclick = () => {
    let v = b.textContent;
    if(v === "="){
      try {
        let e = calcScreen.value.replace(/÷/g,"/").replace(/×/g,"*");
        calcScreen.value = Function("return "+e)();
      } catch {
        calcScreen.value = "Error";
      }
    } else if(v === "DEL") calcScreen.value = calcScreen.value.slice(0,-1);
    else if(v === "C") calcScreen.value = "";
    else {
      if(calcScreen.value === "Error") calcScreen.value = "";
      calcScreen.value += v;
    }
  };
});

/******** UTILS ********/
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/******** INIT ********/
render();