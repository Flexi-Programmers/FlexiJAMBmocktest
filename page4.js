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

if(!candidateName || !selectedSubjects){
    alert("Session expired. Please restart exam.");
    location.href = "page1.html";
}

document.getElementById("candName").textContent = candidateName;

/******** FILTER SUBJECTS & SHUFFLE QUESTIONS ********/
const filteredExamData = {};
selectedSubjects.forEach(s => {
    if(examData[s]){
        filteredExamData[s] = shuffle([...examData[s]]);
    } else {
        console.warn("Subject missing in examData:", s);
    }
});

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
    filteredExamData[s].forEach((q,i) => {
        optionOrder[s][i] = shuffle(Object.keys(q.options));
    });
});

/******** SUBJECT TABS ********/
const tabs = document.getElementById("subjectTabs");
subjects.forEach(s => {
    const t = document.createElement("div");
    t.className = "subject-tab";
    t.textContent = s;
    t.onclick = () => { currentSubject = s; qIndex = 0; render(); };
    tabs.appendChild(t);
});
if(tabs.firstChild) tabs.firstChild.classList.add("active");

/******** RENDER ********/
function render(){
    // Activate current tab
    document.querySelectorAll(".subject-tab").forEach(t => t.classList.remove("active"));
    [...tabs.children].find(t=>t.textContent===currentSubject)?.classList.add("active");

    // Question text
    const q = filteredExamData[currentSubject][qIndex];
    document.getElementById("questionText").textContent = `${qIndex+1}. ${q.question}`;

    // Options
    const optBox = document.getElementById("options");
    optBox.innerHTML = "";
    optionOrder[currentSubject][qIndex].forEach(k => {
        const b = document.createElement("button");
        b.className = "option-circle";
        b.textContent = q.options[k];
        if(answers[currentSubject][qIndex]===k) b.classList.add("selected");
        b.onclick = () => { answers[currentSubject][qIndex] = k; render(); };
        optBox.appendChild(b);
    });

    renderNums();
}

/******** QUESTION NUMBERS ********/
function renderNums(){
    const box = document.getElementById("qnums");
    box.innerHTML = "";
    filteredExamData[currentSubject].forEach((_,i)=>{
        const d = document.createElement("div");
        d.className = "qnum " + (answers[currentSubject][i] ? "green":"red");
        if(i===qIndex) d.classList.add("current");
        d.textContent = i+1;
        d.onclick = () => { qIndex = i; render(); };
        box.appendChild(d);
    });
}

/******** NAVIGATION ********/
prevBtn.onclick = () => { if(qIndex>0){ qIndex--; render(); } };
nextBtn.onclick = () => { if(qIndex<filteredExamData[currentSubject].length-1){ qIndex++; render(); } };

/******** TIMER ********/
const total = 20*60;
const endTime = Date.now() + total*1000;
const timer = setInterval(()=>{
    const left = Math.max(0, Math.floor((endTime - Date.now())/1000));
    timeText.textContent = `00:${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;
    timerBar.style.width = (left/total)*100 + "%";
    if(left <= 0) submit("timeout");
}, 500);

/******** AUTO-SAVE ********/
function autoSave(){
    localStorage.setItem("cbt_answers", JSON.stringify(answers));
}
setInterval(autoSave, 5000); // save every 5 seconds

/******** SUBMIT ********/
async function submit(reason){
    clearInterval(timer);
    const score = calculateScore();
    try{
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
    } catch(err){
        alert("Submission failed");
        console.error(err);
    }
}
submitBtn.onclick = () => confirm("Submit exam?") && submit("manual");

/******** AUTO-SUBMIT ON PAGE SWITCH ONLY ********/
document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) submit("auto");
});

/******** SCORE CALCULATION ********/
function calculateScore(){
    let raw=0,total=0;
    subjects.forEach(s=>{
        filteredExamData[s].forEach((q,i)=>{
            total++;
            if(answers[s][i] === q.answer) raw++;
            else if(answers[s][i]) raw -= 0.25;
        });
    });
    return { rawScore: raw.toFixed(2), jambScore: Math.round((raw/total)*400) };
}

/******** TTS ********/
volumeBtn.onclick = ()=>{
    const q = filteredExamData[currentSubject][qIndex];
    const opts = optionOrder[currentSubject][qIndex].map((k,i)=>`Option ${i+1}: ${q.options[k]}`).join(". ");
    const utter = new SpeechSynthesisUtterance(`Question ${qIndex+1}. ${q.question}. ${opts}`);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
};

/******** CALCULATOR ********/
openCalcBtn.onclick = () => calcModal.style.display = "flex";
document.querySelector(".close-calc").onclick = () => calcModal.style.display = "none";

document.querySelectorAll(".calc-keys button").forEach(b=>{
    b.onclick = () => {
        let v = b.textContent;
        if(v === "="){
            try{
                let e = calcScreen.value.replace(/÷/g,"/").replace(/×/g,"*");
                calcScreen.value = Function("return " + e)();
            }catch{ calcScreen.value="Error"; }
        } else if(v==="DEL") calcScreen.value = calcScreen.value.slice(0,-1);
        else if(v==="C") calcScreen.value = "";
        else {
            if(calcScreen.value === "Error") calcScreen.value = "";
            calcScreen.value += v;
        }
    };
});

/******** SHUFFLE UTILS ********/
function shuffle(a){
    for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/******** INITIAL RENDER ********/
render();