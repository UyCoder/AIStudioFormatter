let activeElement = null;

// --- ئۇيغۇرچىنى ئوقۇش ئۈچۈن خەرپ ئالماشتۇرۇش جەدۋىلى ---
const UY_TO_ULY_MAP = {'ا':'a','ە':'e','ب':'b','پ':'p','ت':'t','ج':'j','چ':'ch','خ':'x','د':'d','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','غ':'gh','ف':'f','ق':'q','ك':'k','گ':'g','ڭ':'ng','ل':'l','م':'m','ن':'n','ھ':'h','و':'o','ۇ':'u','ۆ':'o','ۈ':'u','ي':'y','ۋ':'v','ې':'e','ى':'i','ئ':'','؟':'?'};
const UY_TO_ULY_MAPT = {'ا':'a','ە':'e','ب':'b','پ':'p','ت':'t','ج':'c','چ':'ç','خ':'hh','د':'d','ر':'r','ز':'z','ژ':'j','س':'s','ش':'ş','غ':'gh','f':'f','ق':'k','ك':'k','گ':'g','ڭ':'n','ل':'l','م':'m','ن':'n','ھ':'h','و':'o','ۇ':'u','ۆ':'ö','ۈ':'ü','ي':'y','ۋ':'v','ې':'e','ى':'i','ئ':'','؟':'?'};

function convertForTTS(text, map) {
    return text.split('').map(c => map[c] || c).join('');
}

let chunks = [];
let chunkIndex = 0;
let isReading = false;

// نۆۋەتتىكى تەڭشەكلەرنى ساقلايدىغان ئوبيېكت
let currentSettings = {
    font: "'UKIJ Tuz', 'Alkatip', sans-serif",
    size: 18,
    lineHeight: 1.6,
    direction: 'rtl',
    align: 'justify'
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "formatText") {
    formatSelectedText();
    showControlPanel();
  }
});

// AI Studio قاتارلىق بەتلەردە خەت شەكلىنى مەجبۇرىي ئۆزگەرتىش ئۈچۈن ھەرىكەتچان Style قوشۇش
function updateStyleTag() {
    let styleEl = document.getElementById('uyg-custom-dynamic-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'uyg-custom-dynamic-style';
        document.head.appendChild(styleEl);
    }
    
    // ".uyghur-formatted-text" كلاسسىغا ئىگە ئېلېمېنت ۋە ئۇنىڭ ئىچىدىكى بارلىق بالىلىرىغا (!important) بىلەن تېڭىش
    styleEl.textContent = `
        .uyghur-formatted-text, .uyghur-formatted-text * {
            font-family: ${currentSettings.font} !important;
            font-size: ${currentSettings.size}px !important;
            line-height: ${currentSettings.lineHeight} !important;
            direction: ${currentSettings.direction} !important;
            text-align: ${currentSettings.align} !important;
        }
        .uyghur-formatted-text {
            text-indent: 2em !important;
        }
    `;
}

function formatSelectedText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  let element = range.commonAncestorContainer;

  if (element.nodeType === 3) { 
    element = element.parentElement;
  }
  
  while (element && element !== document.body && window.getComputedStyle(element).display.includes('inline')) {
      element = element.parentElement;
  }

  if (element) {
    activeElement = element;
    
    // ئۆزگىچە كلاس قوشۇش ئارقىلىق CSS سىستېمىسىنى تونۇتۇش
    activeElement.classList.add('uyghur-formatted-text');
    updateStyleTag();
  }
}

// --- ئەلا سۈپەتلىك ئاۋاز تېپىش لوگىكىسى ---
function getBestVoice(langPrefix) {
    const voices = window.speechSynthesis.getVoices();
    let filtered = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    
    if (filtered.length === 0) return null;

    let bestVoice = filtered.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Online') || 
        v.name.includes('Premium') || 
        v.name.includes('Google')
    );

    return bestVoice || filtered[0]; 
}

// --- ئاۋازلىق ئوقۇش لوگىكىسى ---
function startReading() {
    stopReading();
    if (!activeElement) return;

    isReading = true;
    let fullText = activeElement.innerText;

    let rawChunks = fullText.split(/[\n。！？.!?]+/);
    chunks = [];
    for (let i = 0; i < rawChunks.length; i++) {
        let clean = rawChunks[i].trim();
        if (clean.length > 0) chunks.push(clean);
    }

    chunkIndex = 0;
    speakNextChunk();
}

function speakNextChunk() {
    if (!isReading) return;
    if (chunkIndex >= chunks.length) {
        isReading = false;
        return;
    }

    const voiceVal = document.getElementById('uyg-voice-select').value;
    const rateVal = parseFloat(document.getElementById('uyg-rate-select').value);
    let chunkText = chunks[chunkIndex];
    let finalText = chunkText;

    if(voiceVal === 'ug-UG0') finalText = convertForTTS(chunkText, UY_TO_ULY_MAPT);
    else if (voiceVal === 'ug-UG') finalText = convertForTTS(chunkText, UY_TO_ULY_MAP);

    const utterance = new SpeechSynthesisUtterance(finalText);
    const voices = window.speechSynthesis.getVoices();
    let chosenVoice = null;
    
    if(voiceVal === 'ug-UG0') {
        chosenVoice = getBestVoice('tr'); 
    } else if (voiceVal === 'ug-UG') {
        chosenVoice = voices.find(v => v.lang.includes('uz') && v.name.includes('Madina')) || getBestVoice('tr');
    } else {
        chosenVoice = getBestVoice(voiceVal); 
    }

    if(chosenVoice) utterance.voice = chosenVoice;
    utterance.rate = rateVal;

    utterance.onend = function() {
        if (isReading) {
            chunkIndex++;
            speakNextChunk();
        }
    };
    utterance.onerror = function() { if (isReading) { chunkIndex++; speakNextChunk(); } };

    window.speechSynthesis.speak(utterance);
}

function nextChunk() {
    if (!isReading || chunks.length === 0) return;
    window.speechSynthesis.cancel();
}

function prevChunk() {
    if (!isReading || chunks.length === 0) return;
    if (chunkIndex > 0) {
        chunkIndex -= 2; 
        if (chunkIndex < -1) chunkIndex = -1;
        window.speechSynthesis.cancel();
    }
}

function stopReading() { 
    isReading = false;
    window.speechSynthesis.cancel(); 
}

// --- كۆزنەك چىقىرىش ---
function showControlPanel() {
  if (document.getElementById('uyg-pro-wrapper')) {
      // ئەگەر كۆزنەك ئاللىبۇرۇن بولسا، يوشۇرۇنغان بولسا ئېچىۋېتىدۇ
      document.getElementById('uyg-pro-panel').style.display = 'block';
      document.getElementById('uyg-toggle-icon').style.display = 'none';
      return;
  }

  // ئاساسلىق ئورالما
  const wrapper = document.createElement('div');
  wrapper.id = 'uyg-pro-wrapper';
  wrapper.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 999999;`;

  // كىچىكلىتىلگەندە كۆرۈنىدىغان ئايكون
  const toggleIcon = document.createElement('div');
  toggleIcon.id = 'uyg-toggle-icon';
  toggleIcon.innerHTML = '⚙️ بىلىك';
  toggleIcon.style.cssText = `
    display: none; cursor: pointer; background: #2563eb; color: white;
    padding: 8px 15px; border-radius: 20px; font-family: 'UKIJ Tuz', sans-serif;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2); font-weight: bold; font-size: 14px;
    border: 2px solid white; transition: background 0.2s;
  `;
  toggleIcon.onmouseover = () => toggleIcon.style.background = '#1d4ed8';
  toggleIcon.onmouseout = () => toggleIcon.style.background = '#2563eb';

  // ئاساسىي كۆزنەك
  const panel = document.createElement('div');
  panel.id = 'uyg-pro-panel';
  
  panel.style.cssText = `
    background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px;
    padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-family: 'UKIJ Tuz', sans-serif; direction: rtl; text-align: right;
    width: 290px; color: #1e293b; transition: all 0.3s ease;
  `;

  const btnStyle = "flex:1; padding:5px; background:#e2e8f0; border:none; border-radius:4px; cursor:pointer; font-family:inherit;";

  panel.innerHTML = `
    <div style="display:flex; justify-content: space-between; align-items:center; border-bottom: 2px solid #3b82f6; margin-bottom: 10px; padding-bottom: 5px;">
        <span style="font-weight: bold; font-size:16px; color:#1d4ed8;">تەھرىرلەش ۋە ئوقۇش</span>
        <button id="uyg-panel-minimize" style="background:none; border:none; font-size:16px; cursor:pointer; color:#64748b; padding:0;" title="يوشۇرۇش">➖</button>
    </div>
    
    <!-- 1. خەت تەڭشىكى -->
    <select id="uyg-font-select" style="width:100%; padding:6px; margin-bottom:10px; border-radius:6px; border:1px solid #ccc; font-family:inherit;">
      <option value="'UKIJ Tuz', sans-serif">خەت: UKIJ Tuz</option>
      <option value="'Alkatip', sans-serif">خەت: Alkatip</option>
      <option value="'Microsoft Uighur', sans-serif">خەت: Microsoft Uighur</option>
      <option value="'Alkatip Tor', sans-serif">خەت: Alkatip Tor</option>
      <option value="'UKIJ Zilwa', sans-serif">خەت: UKIJ Zilwa</option>
      <option value="'Calibri', sans-serif">خەت: Calibri</option>
      <option value="'Arabic Typesetting', serif">خەت: Arabic Typesetting</option>
    </select>

    <div style="display:flex; justify-content: space-between; margin-bottom: 10px; gap:5px;">
      <button id="uyg-size-down" style="${btnStyle}">خەت -</button>
      <button id="uyg-size-up" style="${btnStyle}">خەت +</button>
      <button id="uyg-line-down" style="${btnStyle}">قۇر -</button>
      <button id="uyg-line-up" style="${btnStyle}">قۇر +</button>
    </div>

    <!-- 2. يۆنىلىش ۋە توغرىلاش -->
    <div style="display:flex; justify-content: space-between; margin-bottom: 5px; gap:5px;">
      <button id="uyg-dir-rtl" style="${btnStyle}; background:#dbeafe; color:#1e40af;">ئوڭدىن ◂</button>
      <button id="uyg-dir-ltr" style="${btnStyle}">سولدىن ▸</button>
    </div>
    <div style="display:flex; justify-content: space-between; margin-bottom: 15px; gap:5px;">
      <button id="uyg-align-justify" style="${btnStyle}; background:#dcfce7; color:#166534;">تەكشى توغرىلاش</button>
      <button id="uyg-align-normal" style="${btnStyle}">ئادەتتىكى</button>
    </div>

    <div style="border-top: 1px dashed #cbd5e1; margin-bottom: 10px;"></div>

    <!-- 3. ئاۋازلىق ئوقۇش تەڭشەكلىرى -->
    <div style="display:flex; gap:5px; margin-bottom:10px;">
        <select id="uyg-voice-select" style="flex:2; padding:6px; border-radius:6px; border:1px solid #ccc; font-family:inherit; direction:ltr;">
            <option value="ug-UG0">Uyghur (Er)</option>
            <option value="ug-UG">Uyghur (Ayal)</option>
            <option value="ar">العربية (Arabic)</option>
            <option value="en">English (Premium)</option>
            <option value="zh">中文 (Chinese)</option>
            <option value="tr">Türkçe (Natural)</option>
        </select>
        <select id="uyg-rate-select" style="flex:1; padding:6px; border-radius:6px; border:1px solid #ccc; direction:ltr;">
            <option value="1.0">1.0x</option>
            <option value="1.5" selected>1.5x</option>
            <option value="2.0">2.0x</option>
        </select>
    </div>

    <!-- كونترول كۇنۇپكىلىرى -->
    <div style="display:flex; justify-content: space-between; margin-bottom: 15px; gap:4px; direction:ltr;">
        <button id="btn-prev" style="flex:1; padding:8px; background:#64748b; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">⏮</button>
        <button id="btn-play" style="flex:1; padding:8px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">▶</button>
        <button id="btn-next" style="flex:1; padding:8px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">⏭</button>
        <button id="btn-stop" style="flex:1; padding:8px; background:#e11d48; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">■</button>
    </div>
    
    <button id="uyg-panel-close" style="width:100%; padding:8px; background:#333; color:white; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold;">ئۈزۈل-كېسىل تاقاش</button>
  `;

  wrapper.appendChild(toggleIcon);
  wrapper.appendChild(panel);
  document.body.appendChild(wrapper);

  // --- ھادىسىلەرنى تىزىملاش ---

  // كىچىكلىتىش ۋە چوڭايتىش
  document.getElementById('uyg-panel-minimize').addEventListener('click', () => {
      panel.style.display = 'none';
      toggleIcon.style.display = 'block';
  });

  toggleIcon.addEventListener('click', () => {
      toggleIcon.style.display = 'none';
      panel.style.display = 'block';
  });
  
  // 1. خەت ۋە قۇر
  document.getElementById('uyg-font-select').addEventListener('change', (e) => {
      currentSettings.font = e.target.value;
      updateStyleTag();
  });

  document.getElementById('uyg-size-up').addEventListener('click', () => { 
      currentSettings.size += 2; 
      updateStyleTag(); 
  });
  document.getElementById('uyg-size-down').addEventListener('click', () => { 
      currentSettings.size -= 2; 
      updateStyleTag(); 
  });

  document.getElementById('uyg-line-up').addEventListener('click', () => { 
      currentSettings.lineHeight += 0.2; 
      updateStyleTag(); 
  });
  document.getElementById('uyg-line-down').addEventListener('click', () => { 
      currentSettings.lineHeight -= 0.2; 
      updateStyleTag(); 
  });

  // 2. يۆنىلىش ۋە توغرىلاش
  document.getElementById('uyg-dir-rtl').addEventListener('click', () => { 
      currentSettings.direction = 'rtl';
      currentSettings.align = 'right';
      updateStyleTag();
  });
  document.getElementById('uyg-dir-ltr').addEventListener('click', () => { 
      currentSettings.direction = 'ltr';
      currentSettings.align = 'left';
      updateStyleTag();
  });

  document.getElementById('uyg-align-justify').addEventListener('click', () => { 
      currentSettings.align = 'justify';
      updateStyleTag();
  });
  document.getElementById('uyg-align-normal').addEventListener('click', () => { 
      currentSettings.align = currentSettings.direction === 'rtl' ? 'right' : 'left';
      updateStyleTag();
  });

  // 3. ئوقۇش
  document.getElementById('btn-play').addEventListener('click', startReading);
  document.getElementById('btn-next').addEventListener('click', nextChunk);
  document.getElementById('btn-prev').addEventListener('click', prevChunk);
  document.getElementById('btn-stop').addEventListener('click', stopReading);

  // 4. تاقاش
  document.getElementById('uyg-panel-close').addEventListener('click', () => {
    stopReading(); 
    wrapper.remove();
  });
  
  window.speechSynthesis.getVoices();
}