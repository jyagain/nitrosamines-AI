// CPCA Calculator Main Frontend Script

let activeTab = 'auto'; // 'auto' or 'manual'
let activeSubTab = 'mfds'; // 'mfds', 'fda', or 'predict'
let lastAutoResult = null;
let lastWizardResult = null;
let jsmeApplet = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial state: run wizard calculation once to display default result
    runWizardCalculation();
    
    // 3. Bind enter key on input fields
    const adiSearchInput = document.getElementById('adiSearchInput');
    if (adiSearchInput) {
        adiSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runAdiLookup();
            }
        });
    }
    
    const fdaSearchInput = document.getElementById('fdaSearchInput');
    if (fdaSearchInput) {
        fdaSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runFdaLookup();
            }
        });
    }
    
    const smilesInput = document.getElementById('smilesInput');
    if (smilesInput) {
        smilesInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runPredictCPCA();
            }
        });
    }
});


/**
 * Switches tabs between 'auto' and 'manual'
 */
function switchTab(tab) {
    activeTab = tab;
    
    // Manage tab buttons active class
    const btnAuto = document.getElementById('tabBtnAuto');
    const btnManual = document.getElementById('tabBtnManual');
    
    // Manage panels active class
    const contentAuto = document.getElementById('tabContentAuto');
    const contentManual = document.getElementById('tabContentManual');
    
    if (tab === 'auto') {
        btnAuto.classList.add('active');
        btnManual.classList.remove('active');
        contentAuto.classList.add('active');
        contentManual.classList.remove('active');
    } else {
        btnAuto.classList.remove('active');
        btnManual.classList.add('active');
        contentAuto.classList.remove('active');
        contentManual.classList.add('active');
    }
}

/**
 * Switches sub-tabs inside Tab 1 (Auto Calculator)
 */
function switchSubTab(subTab) {
    activeSubTab = subTab;
    
    const btnMfds = document.getElementById('subTabBtnMfds');
    const btnFda = document.getElementById('subTabBtnFda');
    const btnPredict = document.getElementById('subTabBtnPredict');
    
    const contentMfds = document.getElementById('subTabContentMfds');
    const contentFda = document.getElementById('subTabContentFda');
    const contentPredict = document.getElementById('subTabContentPredict');
    
    // Deactivate all
    [btnMfds, btnFda, btnPredict].forEach(btn => btn && btn.classList.remove('active'));
    [contentMfds, contentFda, contentPredict].forEach(c => c && c.classList.remove('active'));
    
    if (subTab === 'mfds') {
        if (btnMfds) btnMfds.classList.add('active');
        if (contentMfds) contentMfds.classList.add('active');
    } else if (subTab === 'fda') {
        if (btnFda) btnFda.classList.add('active');
        if (contentFda) contentFda.classList.add('active');
    } else if (subTab === 'predict') {
        if (btnPredict) btnPredict.classList.add('active');
        if (contentPredict) contentPredict.classList.add('active');
        
        // Redraw canvas if structure exists when switching to predict tab
        const smilesInput = document.getElementById('smilesInput');
        if (smilesInput && smilesInput.value.trim()) {
            redrawCanvas();
        }
    }
}


/**
 * 식약처 기준 설정 니트로사민류 조회
 */
function runAdiLookup() {
    const adiSearchInput = document.getElementById('adiSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    
    if (!adiSearchInput || !outputArea) return;
    
    const inputVal = adiSearchInput.value.trim();
    if (!inputVal) {
        alert("CAS 번호, 발생성분명 또는 불순물명을 입력해 주세요.");
        return;
    }
    
    // Check if input is a CAS Number (pattern like XX-XX-X)
    const cleanedInput = inputVal.replace(/\s/g, '');
    const casRegex = /^\d{2,7}-\d{2}-\d$/;
    
    if (casRegex.test(cleanedInput)) {
        runCasLookupAndAnalysis(cleanedInput, outputArea, placeholder, canvas);
        return;
    }
    
    runTextSearchAnalysis(inputVal, outputArea, placeholder, canvas);
}

/**
 * 신규 니트로사민류 예측 실행
 */
function runPredictCPCA() {
    const smilesInput = document.getElementById('smilesInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    
    if (!smilesInput || !outputArea) return;
    
    const smiles = smilesInput.value.trim();
    if (!smiles) {
        alert("SMILES 화학식을 입력해 주세요.");
        return;
    }
    
    // Validation: check if input is a valid smiles representation rather than a query
    if (!isSmilesPattern(smiles)) {
        alert("올바른 SMILES 화학식을 입력해 주세요. (예: CCN(CC)N=O)");
        return;
    }
    
    // SMILES Mode
    const result = window.calculateCPCA(smiles);
    const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
    lastAutoResult = {
        smiles: smiles,
        targetName: getSampleNameBySmiles(smiles) || "사용자 직접 입력 구조식",
        mdd: isNaN(mddVal) ? null : mddVal,
        ...result
    };
    
    // Draw structure
    drawSmilesStructure(smiles, placeholder, canvas, result);
    
    // Display Results
    renderResults(outputArea, lastAutoResult);
    
    // Sync to JSME if it is initialized and visible
    if (jsmeApplet && document.getElementById('jsmeContainer').style.display !== 'none') {
        jsmeApplet.readGenericMolecularInput(smiles);
    }
    
    // Background match checks for official database to guide risk compliance
    checkPredictSMILESMatch(smiles, (match, dbSource) => {
        if (match) {
            const warningContainer = document.createElement('div');
            warningContainer.className = 'warning-alert-box';
            warningContainer.style.marginBottom = '1.5rem';
            
            const isFda = dbSource === 'FDA';
            const authority = isFda ? 'FDA' : '식약처';
            const actionText = isFda ? 'FDA 설정 기준 데이터 보기' : '식약처 설정 기준 데이터 보기';
            const clickHandler = isFda 
                ? `window.selectAndAnalyzeFdaItemByNo(${match.id}); switchSubTab('fda');`
                : `window.selectAndAnalyzeItemByNo(${match.no}); switchSubTab('mfds');`;
            
            warningContainer.innerHTML = `
                <div class="alert-title" style="color: #b45309; display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                    <i class="fa-solid fa-triangle-exclamation"></i> 주의: ${authority} 설정 기준 존재 물질
                </div>
                <div class="alert-body" style="font-size: 0.95rem; line-height: 1.5; margin-top: 0.5rem; color: #78350f;">
                    이 물질은 ${authority}에서 섭취허용량 기준을 이미 설정하여 발표한 물질(<strong>${match.name}</strong>, AI: <strong>${match.ai} ng/day</strong>)과 일치하거나 매우 유사합니다.<br>
                    따라서 CPCA 예측 결과보다 ${authority}가 공식 발표한 허용량 기준을 우선 준수해야 합니다.
                    <button class="btn btn-secondary btn-sm" style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem;" onclick="${clickHandler}">
                        <i class="fa-solid fa-building-shield"></i> ${actionText}
                    </button>
                </div>
            `;
            const dashboard = outputArea.querySelector('.res-dashboard');
            if (dashboard) {
                dashboard.insertBefore(warningContainer, dashboard.firstChild);
            }
        }
    });
}

/**
 * Background search API checks for prediction to lookup matching official records
 */
function checkPredictSMILESMatch(smiles, callback) {
    // 1. Local Preset database direct matching (MFDS)
    let localSample = window.nitrosamineSamples?.find(s => s.smiles === smiles);
    if (localSample) {
        let m = window.MFDS_ADI_DATABASE?.find(item => 
            (item.cas && localSample.cas && item.cas === localSample.cas) ||
            (item.name && item.name.toLowerCase() === localSample.name.toLowerCase())
        );
        if (m) {
            callback(m, 'MFDS');
            return;
        }
        
        let fdaM = window.FDA_ADI_DATABASE?.find(item => 
            (item.name && item.name.toLowerCase() === localSample.name.toLowerCase()) ||
            (item.api && localSample.name && item.api.toLowerCase() === localSample.name.toLowerCase())
        );
        if (fdaM) {
            callback(fdaM, 'FDA');
            return;
        }
    }

    // 2. Query PubChem database for CAS/Name from SMILES representation
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/chemical/smiles/${encodeURIComponent(smiles)}/synonyms/JSON`)
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            const synonyms = data.InformationList?.Information?.[0]?.Synonym || [];
            const casRegex = /^\d{2,7}-\d{2}-\d$/;
            let foundCas = null;
            
            for (let syn of synonyms) {
                if (casRegex.test(syn)) {
                    foundCas = syn;
                    break;
                }
            }
            
            let match = null;
            let source = 'MFDS';
            if (foundCas && window.MFDS_ADI_DATABASE) {
                match = window.MFDS_ADI_DATABASE.find(item => item.cas === foundCas);
            }
            
            if (!match && window.MFDS_ADI_DATABASE) {
                for (let syn of synonyms) {
                    let m = window.MFDS_ADI_DATABASE.find(item => 
                        item.name && item.name.toLowerCase() === syn.toLowerCase()
                    );
                    if (m) {
                        match = m;
                        break;
                    }
                }
            }
            
            if (!match && window.FDA_ADI_DATABASE) {
                for (let syn of synonyms) {
                    let m = window.FDA_ADI_DATABASE.find(item => 
                        item.name && item.name.toLowerCase() === syn.toLowerCase()
                    );
                    if (m) {
                        match = m;
                        source = 'FDA';
                        break;
                    }
                }
            }
            
            callback(match, source);
        })
        .catch(err => {
            callback(null);
        });
}

function showDrawingError() {
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    canvas.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <i class="fa-solid fa-circle-xmark" style="color: var(--text-muted)"></i>
        <p>화학 구조 2D 드로잉 실패<br><small>SMILES 문자법 오류</small></p>
    `;
}

/**
 * Searches sample list by SMILES
 */
function getSampleNameBySmiles(smiles) {
    if (!window.nitrosamineSamples) return null;
    const match = window.nitrosamineSamples.find(s => s.smiles === smiles);
    return match ? match.name : null;
}

/**
 * Utility function to increment/decrement counters
 */
function adjustCounter(id, delta) {
    const input = document.getElementById(id);
    if (!input) return;
    
    let val = parseInt(input.value) + delta;
    const min = parseInt(input.getAttribute('min'));
    const max = parseInt(input.getAttribute('max'));
    
    if (val >= min && val <= max) {
        input.value = val;
        // Dispatch event so that form.onchange triggers recalculation
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
    }
}

/**
 * Main manual wizard calculation
 */
function runWizardCalculation() {
    const outputArea = document.getElementById('wizardOutputArea');
    if (!outputArea) return;
    
    const form = document.getElementById('wizardForm');
    if (!form) return;
    
    // 1. Read Form Inputs
    const mddVal = parseFloat(document.getElementById('mddInputManual').value);
    const alphaHChoice = form.elements['wizAlphaH'].value;
    const hasAcid = document.getElementById('wizAcid').checked;
    const ringChoice = document.getElementById('wizRing').value;
    const hasChain = document.getElementById('wizChain').checked;
    const ewgCount = parseInt(document.getElementById('wizEwgCount').value);
    const ohCount = parseInt(document.getElementById('wizOhCount').value);
    const hasAryl = document.getElementById('wizAryl').checked;
    const hasBetaMethyl = document.getElementById('wizMethyl').checked;
    
    // 2. Perform Calculation
    const messages = ["수동 위자드 판정 시작"];
    let score = null;
    let category = 5;
    let ai = "1500 ng/day 이상";
    
    // Base score based on alpha hydrogens
    let baseScoreText = "";
    if (alphaHChoice === '1,2') {
        score = 3;
        baseScoreText = "α-탄소 수소 조합 [1, 2] 또는 [1, 3]: 기본 α-수소 점수 +3점";
    } else if (alphaHChoice === '0,2') {
        score = 3;
        baseScoreText = "α-탄소 수소 조합 [0, 2] (기본형): 기본 α-수소 점수 +3점";
    } else if (alphaHChoice === '0,2_ethyl') {
        score = 2;
        baseScoreText = "α-탄소 수소 조합 [0, 2] (에틸기 포함 예외): 기본 α-수소 점수 +2점";
    } else if (alphaHChoice === '0,3') {
        score = 2;
        baseScoreText = "α-탄소 수소 조합 [0, 3]: 기본 α-수소 점수 +2점";
    } else if (alphaHChoice === '2,2') {
        score = 1;
        baseScoreText = "α-탄소 수소 조합 [2, 2] 또는 [2, 3]: 기본 α-수소 점수 +1점";
    } else if (alphaHChoice === 'tertiary') {
        score = null;
        baseScoreText = "3차 α-탄소(Tertiary alpha-carbon) 존재: 등급 분류 점수 테이블 제외";
        messages.push("3차 α-탄소 존재로 전위 평가를 생략하고 최고 범주인 Category 5로 결정합니다.");
    } else {
        score = null;
        baseScoreText = "기타 (알파 수소 없거나 1개 이하, [3,3] 등): 등급 분류 점수 테이블 제외";
        messages.push("유효 점수 테이블 범위 외 구조로 최고 범주인 Category 5로 결정합니다.");
    }
    
    if (score !== null) {
        messages.push(baseScoreText);
        
        // Carboxylic Acid
        if (hasAcid) {
            score += 3;
            messages.push("카르복실산(Carboxylic Acid) 존재: 비활성화 인자 +3점 가산");
        }
        
        // Ring Related
        if (ringChoice !== '0') {
            if (ringChoice === '3') {
                score += 3;
                messages.push("피롤리딘(Pyrrolidine) 고리 구조 포함: 비활성화 인자 +3점 가산");
            } else if (ringChoice === '3_S') {
                score += 3;
                messages.push("황(S) 포함 6원 고리 포함: 비활성화 인자 +3점 가산");
            } else if (ringChoice === '2') {
                score += 2;
                messages.push("기타 5원 또는 6원 포화 고리 포함: 비활성화 인자 +2점 가산");
            } else if (ringChoice === '1') {
                score += 1;
                messages.push("7원 포화 고리 포함: 비활성화 인자 +1점 가산");
            } else if (ringChoice === '1_M') {
                score += 1;
                messages.push("모폴린(Morpholine) 고리 구조 포함: 비활성화 인자 +1점 가산");
            }
        }
        
        // Chains >= 5 non-H atoms
        if (hasChain) {
            score += 1;
            messages.push("양측 모두 연속 5개 이상의 비수소 원자 사슬 존재: 비활성화 인자 +1점 가산");
        }
        
        // EWGs
        if (ewgCount > 0) {
            score += ewgCount;
            messages.push(`α-탄소 결합 전자끌림기(EWG) ${ewgCount}개 존재: 비활성화 인자 +${ewgCount}점 가산`);
        }
        
        // OH on Beta
        if (ohCount > 0) {
            score += ohCount;
            messages.push(`β-탄소 결합 하이드록실기(-OH) ${ohCount}개 존재: 비활성화 인자 +${ohCount}점 가산`);
        }
        
        // Aryl on Alpha
        if (hasAryl) {
            score -= 1;
            messages.push("α-탄소에 아릴기(Aryl) 결합: 활성화 인자 -1점 감산");
        }
        
        // Methyl on Beta
        if (hasBetaMethyl) {
            score -= 1;
            messages.push("β-탄소에 메틸기 결합(1H 보유 β-탄소): 활성화 인자 -1점 감산");
        }
    }
    
    // Map to category
    if (score === null) {
        category = 5;
        ai = "1500 ng/day 이상";
    } else if (score <= 1) {
        category = 1;
        ai = "26.5 ng/day";
    } else if (score === 2) {
        category = 2;
        ai = "100 ng/day";
    } else if (score === 3) {
        category = 3;
        ai = "400 ng/day";
    } else if (score >= 4) {
        category = 4;
        ai = "1500 ng/day";
    }
    
    lastWizardResult = {
        success: true,
        category: category,
        score: score,
        ai: ai,
        messages: messages,
        mdd: isNaN(mddVal) ? null : mddVal,
        targetName: "수동 자가진단 리포트",
        smiles: "N/A (자가진단 마법사 평가)"
    };
    
    // Render
    renderResults(outputArea, lastWizardResult);
}

/**
 * Dynamic HTML render of results dashboard inside card
 */
function renderResults(container, result) {
    if (!result.success) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger)"></i>
                <h3>평가 실패</h3>
                <p>${result.error || '입력값을 파싱할 수 없거나 분류 테이블 범위를 이탈하였습니다.'}</p>
            </div>
        `;
        return;
    }
    
    // Build list of message LI elements
    const reasonItems = result.messages.map((msg, idx) => {
        let iconClass = "fa-info-circle info";
        let isDeactivating = msg.includes("비활성화") || msg.includes("가산");
        let isActivating = msg.includes("활성화") || msg.includes("감산");
        
        if (isDeactivating) iconClass = "fa-circle-plus plus";
        else if (isActivating) iconClass = "fa-circle-minus minus";
        else if (idx === 0) iconClass = "fa-flask info";
        
        return `
            <li class="reason-item">
                <i class="fa-solid ${iconClass} reason-icon"></i>
                <div class="reason-text">${msg}</div>
            </li>
        `;
    }).join('');
    
    // Expected Category Badge style class
    const badgeClass = `badge-cat-${result.category}`;
    const displayScore = result.score === null ? "N/A" : `${result.score} 점`;
    
    let warningHtml = '';
    if (result.compoundSpecific) {
        warningHtml = `
            <div class="warning-alert-box">
                <div class="alert-title">
                    <i class="fa-solid fa-triangle-exclamation"></i> 주의: 식약처 설정 자체 독성값 존재 물질
                </div>
                <div class="alert-body">
                    이 물질은 규제 기관(식약처/EMA/FDA)에서 발암성 연구 데이터를 기반으로 별도 지정한 <strong>자체 독성값(Compound-Specific AI)</strong>이 존재합니다.<br>
                    따라서 CPCA 분류 등급을 적용하지 않으며, 공식 발표 기준치인 <strong>${result.compoundSpecific.ai}</strong>를 우선 준수해야 합니다.
                </div>
            </div>
        `;
    }
    
    let casComparisonHtml = '';
    if (result.casMatch) {
        const officialCat = result.casMatch.category;
        const officialAi = result.casMatch.ai;
        const calculatedCat = result.category;
        
        let matchClass = 'match-success';
        let matchText = '<i class="fa-solid fa-circle-check"></i> 식약처 발표 기준치와 등급 계산 결과가 일치합니다.';
        
        if (officialCat !== null && calculatedCat !== null) {
            if (parseInt(officialCat) !== parseInt(calculatedCat)) {
                matchClass = 'match-warning';
                matchText = '<i class="fa-solid fa-triangle-exclamation"></i> 주의: 계산된 등급과 식약처 발표 기준 등급이 상이합니다. 식약처 발표 기준치 적용이 필요합니다.';
            }
        } else if (officialCat === null) {
            matchClass = 'match-info';
            matchText = '<i class="fa-solid fa-circle-info"></i> 해당 물질은 CPCA가 아닌 다른 방법(예: 유사체 참조, 독성 시험 등)으로 설정된 섭취허용량입니다.';
        }
        
        casComparisonHtml = `
            <div class="cas-comparison-box ${matchClass}">
                <div class="comp-title"><i class="fa-solid fa-building-shield"></i> 식약처 발표 기준 불순물 DB 조회 완료 (연번: ${result.casMatch.no})</div>
                <table class="comp-table">
                    <tr>
                        <th>공식 물질명</th>
                        <td>${result.casMatch.name}</td>
                        <th>발생 활성성분</th>
                        <td>${result.casMatch.active || '해당 없음'}</td>
                    </tr>
                    <tr>
                        <th>식약처 설정 카테고리</th>
                        <td>${officialCat ? 'Category ' + officialCat : '등급 분류 제외 (N/A)'}</td>
                        <th>식약처 발표 허용량 (AI)</th>
                        <td><strong>${officialAi} ng/day</strong></td>
                    </tr>
                    ${result.casMatch.remark ? `<tr><th>비고 (산출 근거)</th><td colspan="3">${result.casMatch.remark}</td></tr>` : ''}
                    <tr>
                        <th>발표일자</th>
                        <td>${result.casMatch.date || '해당 없음'}</td>
                        <th>결과 비교</th>
                        <td colspan="3"><strong>${matchText}</strong></td>
                    </tr>
                </table>
            </div>
        `;
    }
    
    let fdaComparisonHtml = '';
    if (result.fdaMatch) {
        const officialCat = result.fdaMatch.category;
        const officialAi = result.fdaMatch.ai;
        const calculatedCat = result.category;
        
        let matchClass = 'match-success';
        let matchText = '<i class="fa-solid fa-circle-check"></i> FDA 발표 기준치와 등급 계산 결과가 일치합니다.';
        
        if (officialCat !== null && calculatedCat !== null) {
            if (parseInt(officialCat) !== parseInt(calculatedCat)) {
                matchClass = 'match-warning';
                matchText = '<i class="fa-solid fa-triangle-exclamation"></i> 주의: 계산된 등급과 FDA 발표 기준 등급이 상이합니다. FDA 발표 기준치 적용이 필요합니다.';
            }
        } else if (officialCat === null) {
            matchClass = 'match-info';
            matchText = '<i class="fa-solid fa-circle-info"></i> 해당 물질은 CPCA가 아닌 다른 방법으로 설정된 섭취허용량입니다.';
        }
        
        fdaComparisonHtml = `
            <div class="cas-comparison-box ${matchClass}">
                <div class="comp-title" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span><i class="fa-solid fa-building-shield"></i> FDA 발표 기준 불순물 DB 조회 완료 (연번: ${result.fdaMatch.id})</span>
                    <span class="badge" style="background-color: var(--color-primary); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">FDA Established AI 기준</span>
                </div>
                <table class="comp-table">
                    <tr>
                        <th>공식 물질명</th>
                        <td>${result.fdaMatch.name}</td>
                        <th>발생 활성성분</th>
                        <td>${result.fdaMatch.api || '해당 없음'}</td>
                    </tr>
                    <tr>
                        <th>FDA 설정 카테고리</th>
                        <td>${officialCat ? 'Category ' + officialCat : '등급 분류 제외 (N/A)'}</td>
                        <th>FDA 발표 허용량 (AI)</th>
                        <td><strong>${officialAi} ng/day</strong></td>
                    </tr>
                    <tr>
                        <th>결과 비교</th>
                        <td colspan="3"><strong>${matchText}</strong></td>
                    </tr>
                </table>
            </div>
        `;
    }
    
    let qcHtml = '';
    if (result.mdd) {
        const numericAi = getNumericAi(result.ai);
        if (numericAi) {
            const limitPpm = numericAi / result.mdd;
            const actionPpm = limitPpm * 0.3;
            const loqPpm = Math.min(limitPpm * 0.1, 0.03);
            
            qcHtml = `
                <div class="qc-limits-card">
                    <div class="qc-title">
                        <i class="fa-solid fa-gauge-high"></i> 의약품 내 불순물 허용 농도 및 관리 기준 (MDD: ${result.mdd} mg/day)
                    </div>
                    <div class="qc-metrics">
                        <div class="qc-metric-box primary">
                            <span class="label">허용 농도 기준 (100% Limit)</span>
                            <span class="value">${formatConcentration(limitPpm)}</span>
                            <span class="desc">출하 규격 상한선 (Specification Limit)</span>
                        </div>
                        <div class="qc-metric-box warning">
                            <span class="label">자체 관리 기준선 (30% Action Level)</span>
                            <span class="value">${formatConcentration(actionPpm)}</span>
                            <span class="desc">이 미만 검출 시 모니터링 생략 가능 (Negligible Risk)</span>
                        </div>
                    </div>
                    <div class="qc-guidelines">
                        <h4><i class="fa-solid fa-clipboard-list"></i> 검출 수준에 따른 품질 관리 대응 가이드라인</h4>
                        <table class="qc-table">
                            <thead>
                                <tr>
                                    <th>실측 분석 농도</th>
                                    <th>위험 수준</th>
                                    <th>조치 및 대응 요구사항 (식약처/EMA 권장)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="success-row">
                                    <td><strong>${formatConcentration(actionPpm)} 미만</strong></td>
                                    <td><span class="badge success">안전 (Negligible)</span></td>
                                    <td>자체 관리 기준선 미만으로 배치 시험 생략 및 일상 모니터링 면제 신청 가능</td>
                                </tr>
                                <tr class="warning-row">
                                    <td><strong>${formatConcentration(actionPpm)} ~ ${formatConcentration(limitPpm)}</strong></td>
                                    <td><span class="badge warning">경계 (Warning)</span></td>
                                    <td>skip testing 또는 정기 시험(Routine Testing) 규격 설정 및 주기적 분석 관리 필요</td>
                                </tr>
                                <tr class="danger-row">
                                    <td><strong>${formatConcentration(limitPpm)} 초과</strong></td>
                                    <td><span class="badge danger">위험 (Exceeded)</span></td>
                                    <td><strong>규격 부적합</strong>. 출하 불가. 제조 공정 개선(아민/아질산염 제거) 및 변경승인 필수</td>
                                </tr>
                            </tbody>
                        </table>
                        <p class="qc-loq-notice">
                            <i class="fa-solid fa-circle-info"></i> <strong>분석 정량한계(LOQ) 권장사항:</strong> 
                            본 물질 분석을 위한 기기 분석법은 최소 <strong>${formatConcentration(loqPpm)}</strong> 이하(허용 기준의 10% 또는 0.03 ppm 중 낮은 값)까지 검출 및 정량이 가능하도록 설정되어야 합니다.
                        </p>
                    </div>
                </div>
            `;
        }
    }
    
    container.innerHTML = `
        <div class="res-dashboard">
            ${warningHtml}
            ${casComparisonHtml}
            ${fdaComparisonHtml}
            ${qcHtml}
            <div class="res-metrics">
                <div class="metric-box">
                    <span class="metric-label">CPCA Category</span>
                    <span class="category-badge-big ${badgeClass}">Cat ${result.category}</span>
                </div>
                <div class="metric-box">
                    <span class="metric-label">섭취허용량 (AI)</span>
                    <span class="ai-value-big">${result.ai}</span>
                    <span class="score-badge">최종 Score: ${displayScore}</span>
                </div>
            </div>
            
            <div class="res-section">
                <h3 class="res-section-title"><i class="fa-solid fa-list-check"></i> 세부 가감점 판정 내역</h3>
                <ul class="reason-list">
                    ${reasonItems}
                </ul>
            </div>
        </div>
    `;
}

/**
 * Triggers document print and prepares the layout for paper report print.
 */
function printResult() {
    const result = (activeTab === 'auto') ? lastAutoResult : lastWizardResult;
    if (!result) {
        alert("출력할 평가 결과가 없습니다. 먼저 계산을 완료해 주세요.");
        return;
    }
    
    // 1. Populate Print Template DOM elements
    document.getElementById('printTargetName').textContent = result.targetName;
    document.getElementById('printTargetSmiles').textContent = result.smiles;
    document.getElementById('printCategory').textContent = `Category ${result.category}`;
    document.getElementById('printAi').textContent = result.ai;
    document.getElementById('printScore').textContent = result.score === null ? "등급 분류 제외 (N/A)" : `${result.score} 점`;
    let modeText = "자가진단 수동 위자드";
    if (activeTab === 'auto') {
        if (activeSubTab === 'mfds') {
            modeText = "식약처 기준 설정 니트로사민류 조회";
        } else if (activeSubTab === 'fda') {
            modeText = "FDA 기준 설정 니트로사민류 조회";
        } else {
            modeText = "신규 니트로사민류 CPCA 예측";
        }
    }
    document.getElementById('printMode').textContent = modeText;
    document.getElementById('printDate').textContent = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // 2. Clone canvas drawing if in auto mode
    const printCanvas = document.getElementById('printSmilesCanvas');
    const srcCanvas = document.getElementById('smilesCanvas');
    const canvasWrapper = printCanvas.parentNode;
    
    if (activeTab === 'auto' && srcCanvas && srcCanvas.style.display !== 'none') {
        canvasWrapper.style.display = 'block';
        printCanvas.width = srcCanvas.width;
        printCanvas.height = srcCanvas.height;
        const ctx = printCanvas.getContext('2d');
        ctx.clearRect(0, 0, printCanvas.width, printCanvas.height);
        ctx.drawImage(srcCanvas, 0, 0);
    } else {
        canvasWrapper.style.display = 'none';
    }
    
    // 2b. Populate Print Warning Area
    const printWarningArea = document.getElementById('printWarningArea');
    if (printWarningArea) {
        if (result.compoundSpecific) {
            printWarningArea.style.display = 'block';
            printWarningArea.innerHTML = `
                <strong>[주의] 식약처 설정 자체 독성값 존재 물질 (CPCA 분류 예외)</strong><br>
                본 물질은 규제 기관(식약처/EMA/FDA)에서 발암성 데이터를 기반으로 별도 지정한 '화합물 특이적 섭취허용량(Compound-Specific AI)'이 존재합니다.<br>
                따라서 CPCA 분류법(Category 1~5)을 적용하지 않으며, 공식 발표 기준치인 <strong>${result.compoundSpecific.ai}</strong>를 우선 준수해야 합니다.
            `;
        } else {
            printWarningArea.style.display = 'none';
        }
    }
    
    // 2c. Populate Print CAS Comparison Area
    const printCasArea = document.getElementById('printCasComparisonArea');
    if (printCasArea) {
        if (result.casMatch) {
            printCasArea.style.display = 'block';
            const officialCat = result.casMatch.category ? `Category ${result.casMatch.category}` : "해당 없음 (N/A)";
            printCasArea.innerHTML = `
                <strong>[조회 확인] 식약처 발표 불순물 기준 DB (연번: ${result.casMatch.no})</strong><br>
                - 공식 물질명: ${result.casMatch.name} | 발생 성분: ${result.casMatch.active || 'N/A'}<br>
                - 식약처 설정 카테고리: ${officialCat} | 식약처 발표 섭취허용량: <strong>${result.casMatch.ai} ng/day</strong><br>
                ${result.casMatch.remark ? `- 비고 (산출 근거): ${result.casMatch.remark}<br>` : ''}
                - 기준 발표일자: ${result.casMatch.date || 'N/A'}
            `;
        } else if (result.fdaMatch) {
            printCasArea.style.display = 'block';
            const officialCat = result.fdaMatch.category ? `Category ${result.fdaMatch.category}` : "해당 없음 (N/A)";
            printCasArea.innerHTML = `
                <strong>[조회 확인] FDA 발표 불순물 기준 DB (연번: ${result.fdaMatch.id}) [FDA Established AI 기준]</strong><br>
                - 공식 물질명: ${result.fdaMatch.name} | 발생 성분: ${result.fdaMatch.api || 'N/A'}<br>
                - FDA 설정 카테고리: ${officialCat} | FDA 발표 섭취허용량: <strong>${result.fdaMatch.ai} ng/day</strong>
            `;
        } else {
            printCasArea.style.display = 'none';
        }
    }
    
    // 2d. Populate Print MDD and Concentration Limit Row
    const printMddRow = document.getElementById('printMddRow');
    const printMddValue = document.getElementById('printMddValue');
    const printLimitValue = document.getElementById('printLimitValue');
    
    if (result.mdd && printMddRow && printMddValue && printLimitValue) {
        printMddRow.style.display = 'table-row';
        printMddValue.textContent = `${result.mdd} mg/day`;
        
        const numericAi = getNumericAi(result.ai);
        if (numericAi) {
            const limitPpm = numericAi / result.mdd;
            printLimitValue.textContent = formatConcentration(limitPpm);
        } else {
            printLimitValue.textContent = "해당 없음";
        }
    } else if (printMddRow) {
        printMddRow.style.display = 'none';
    }
    
    // 3. Populate printed reasons list
    const printMessages = document.getElementById('printReportMessages');
    printMessages.innerHTML = result.messages.map(msg => `<li>${msg}</li>`).join('');
    
    // 4. Trigger print
    window.print();
}

/**
 * Toggles between SmilesDrawer static canvas and JSME interactive editor
 */
function toggleDrawMode() {
    const canvas = document.getElementById('smilesCanvas');
    const placeholder = document.getElementById('canvasPlaceholder');
    const jsmeContainer = document.getElementById('jsmeContainer');
    const drawBtnText = document.getElementById('drawBtnText');
    const redrawBtn = document.getElementById('btnRedrawCanvas');
    
    if (jsmeContainer.style.display === 'none') {
        // Switch to Draw Mode (Editor)
        canvas.style.display = 'none';
        placeholder.style.display = 'none';
        jsmeContainer.style.display = 'block';
        if (redrawBtn) redrawBtn.style.display = 'none';
        drawBtnText.innerHTML = '<i class="fa-solid fa-eye"></i> 2D 구조 보기';
        
        // Load JSME if not done yet
        if (!jsmeApplet) {
            initJSME();
        } else {
            // Synchronize with current input SMILES
            const currentSmiles = document.getElementById('smilesInput').value.trim();
            if (currentSmiles) {
                try {
                    jsmeApplet.readGenericMolecularInput(currentSmiles);
                } catch (e) {
                    console.error("JSME input load error: ", e);
                }
            }
        }
    } else {
        // Switch to View Mode (SmilesDrawer)
        jsmeContainer.style.display = 'none';
        canvas.style.display = 'block';
        if (redrawBtn) redrawBtn.style.display = 'inline-block';
        drawBtnText.innerHTML = '<i class="fa-solid fa-pen"></i> 분자 구조 직접 그리기';
        
        // Recalculate and redraw SmilesDrawer
        const currentSmiles = document.getElementById('smilesInput').value.trim();
        if (currentSmiles) {
            runAutoCalculation();
        } else {
            placeholder.style.display = 'flex';
            canvas.style.display = 'none';
        }
    }
}

/**
 * Dynamically loads and initializes the JSME molecular editor
 */
function initJSME() {
    // 1. Define global callback for GWT load
    window.jsmeOnLoad = function() {
        let JAppletClass = null;
        if (typeof JSApplet !== 'undefined' && JSApplet.JSME) {
            JAppletClass = JSApplet.JSME;
        } else if (typeof JSME !== 'undefined' && JSME.jsmeApplet) {
            JAppletClass = JSME.jsmeApplet;
        } else if (typeof JSME !== 'undefined' && JSME.JSME) {
            JAppletClass = JSME.JSME;
        }

        if (JAppletClass) {
            try {
                jsmeApplet = new JAppletClass("jsmeContainer", "400px", "300px", {
                    options: "query,stereo,nohydrogens"
                });
                
                // Register modification listener
                jsmeApplet.setCallBack("AfterStructureModified", (event) => {
                    let smiles = jsmeApplet.smiles();
                    const smilesInput = document.getElementById('smilesInput');
                    if (smiles !== null && smilesInput) {
                        smilesInput.value = smiles;
                        // Recalculate CPCA in real-time
                        runAutoCalculationFromEditor(smiles);
                    }
                });
                
                // Set initial SMILES
                const currentSmiles = document.getElementById('smilesInput').value.trim();
                if (currentSmiles) {
                    try {
                        jsmeApplet.readGenericMolecularInput(currentSmiles);
                    } catch (e) {
                        console.error("JSME load initial SMILES error: ", e);
                    }
                }
            } catch (initErr) {
                console.error("Error creating JSME applet instance: ", initErr);
            }
        } else {
            console.error("JSME loader callback fired, but JSApplet.JSME / JSME.jsmeApplet constructors are undefined.");
        }
    };
    
    // 2. Append JSME nocache script tag
    const script = document.createElement('script');
    script.type = "text/javascript";
    script.src = "https://jsme-editor.github.io/dist/jsme/jsme.nocache.js";
    document.head.appendChild(script);
}

/**
 * Runs CPCA calculation in real-time without redrawing SmilesDrawer canvas
 * (avoiding conflict during active editing session in JSME)
 */
function runAutoCalculationFromEditor(smiles) {
    if (!smiles) return;
    const outputArea = document.getElementById('resultOutputArea');
    if (!outputArea) return;
    
    const result = window.calculateCPCA(smiles);
    lastAutoResult = {
        smiles: smiles,
        targetName: getSampleNameBySmiles(smiles) || "직접 그린 구조식",
        ...result
    };
    
    renderResults(outputArea, lastAutoResult);
}

/**
 * Resolves a CAS Number locally via MFDS database and online via PubChem API,
 * then performs CPCA calculation and visualizes the structure.
 */
function runCasLookupAndAnalysis(casNo, outputArea, placeholder, canvas) {
    // 1. Local Database search
    let localMatch = null;
    if (window.MFDS_ADI_DATABASE) {
        localMatch = window.MFDS_ADI_DATABASE.find(item => item.cas === casNo);
    }
    
    // Show Loading state
    outputArea.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3.5rem; color: var(--color-primary); margin-bottom: 1.5rem;"></i>
            <h3>CAS 구조 정보 조회 중...</h3>
            <p>CAS 번호 <strong>${casNo}</strong>의 화학 구조 정보를 로컬 DB 및 PubChem에서 조회하고 있습니다.</p>
        </div>
    `;
    
    // 2. Fetch SMILES from PubChem REST API
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/chemical/name/${casNo}/property/CanonicalSMILES/JSON`)
        .then(response => {
            if (!response.ok) throw new Error("PubChem API returned error");
            return response.json();
        })
        .then(data => {
            const properties = data.PropertyTable?.Properties?.[0];
            const smiles = properties?.CanonicalSMILES;
            if (!smiles) {
                throw new Error("No Canonical SMILES property returned");
            }
            
            // Success: Calculate CPCA using resolved SMILES
            const result = window.calculateCPCA(smiles);
            const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
            
            // Build Auto Result
            lastAutoResult = {
                smiles: smiles,
                targetName: localMatch ? localMatch.name : `CAS ${casNo} (PubChem 조회)`,
                mdd: isNaN(mddVal) ? null : mddVal,
                ...result,
                casMatch: localMatch,
                queryCas: casNo
            };
            
            // Draw SMILES structure
            drawSmilesStructure(smiles, placeholder, canvas, result);
            
            // Display results
            renderResults(outputArea, lastAutoResult);
            
            // Sync to JSME if it is initialized and visible
            if (jsmeApplet && document.getElementById('jsmeContainer').style.display !== 'none') {
                jsmeApplet.readGenericMolecularInput(smiles);
            }
        })
        .catch(err => {
            console.error("CAS SMILES resolution failed: ", err);
            
            // Fallback: If we have local official data but failed to fetch SMILES (or offline)
            if (localMatch) {
                const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
                lastAutoResult = {
                    smiles: "N/A (SMILES 구조 정보 조회 실패)",
                    targetName: localMatch.name,
                    success: true,
                    category: localMatch.category,
                    score: null,
                    ai: localMatch.ai ? `${localMatch.ai} ng/day` : "식약처 기준",
                    mdd: isNaN(mddVal) ? null : mddVal,
                    messages: [
                        `식약처 1일 섭취허용량 기준 목록 등록 확인 (연번: ${localMatch.no})`,
                        `발생 성분: ${localMatch.active || '해당 없음'}`,
                        `식약처 기준 섭취허용량: ${localMatch.ai} ng/day (CPCA Category ${localMatch.category || 'N/A'})`,
                        `비고 (산출 근거): ${localMatch.remark || '없음'}`,
                        `공개일자: ${localMatch.date || 'N/A'}`
                    ],
                    patternsCount: 0,
                    casMatch: localMatch,
                    queryCas: casNo
                };
                
                // Show drawing error in canvas
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.style.display = 'none';
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <i class="fa-solid fa-circle-info" style="color: var(--color-primary)"></i>
                    <p>구조식 시각화 실패 (오프라인 상태)<br><small>식약처 기준 데이터 기준으로 연산을 대체 출력합니다.</small></p>
                `;
                
                renderResults(outputArea, lastAutoResult);
            } else {
                // Completely failed
                outputArea.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-circle-question" style="color: var(--color-danger); font-size: 3.5rem; margin-bottom: 1.5rem;"></i>
                        <h3>CAS 분석 불가</h3>
                        <p>입력된 CAS 번호 <strong>${casNo}</strong>는 로컬 식약처 기준 DB에 등재되어 있지 않으며, PubChem을 통한 화학 구조식(SMILES) 획득에도 실패했습니다.</p>
                        <small style="margin-top: 1rem; color: var(--text-muted);">인터넷 연결 상태를 점검하시거나 해당 불순물의 SMILES를 직접 입력해 주세요.</small>
                    </div>
                `;
            }
        });
}

/**
 * Redraws the canvas for the current SMILES input
 */
function redrawCanvas() {
    const smilesInput = document.getElementById('smilesInput');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    if (!smilesInput || !canvas || !placeholder) return;
    
    const smiles = smilesInput.value.trim();
    if (!smiles) return;
    
    const result = window.calculateCPCA(smiles);
    drawSmilesStructure(smiles, placeholder, canvas, result);
}

/**
 * Draws the molecular structure using SmilesDrawer
 */
function drawSmilesStructure(smiles, placeholder, canvas, result) {
    if (result.success && window.SmilesDrawer) {
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        
        try {
            const smilesDrawer = new SmilesDrawer.Drawer({
                width: 400,
                height: 300,
                bondThickness: 1.6,
                bondLength: 16,
                fontSizeLarge: 14,
                fontSizeSmall: 10,
                padding: 15
            });
            
            window.SmilesDrawer.parse(smiles, (tree) => {
                smilesDrawer.draw(tree, 'smilesCanvas', 'light', false);
            }, (err) => {
                console.error("SmilesDrawer Drawing Error: ", err);
                showDrawingError();
            });
        } catch (e) {
            console.error("Drawing instantiation error: ", e);
            showDrawingError();
        }
    } else {
        // Clear canvas and show placeholder on failure
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger)"></i>
            <p>구조를 시각화할 수 없습니다.<br><small>${result.error || '유효하지 않은 SMILES'}</small></p>
        `;
    }
}

/**
 * Synchronizes MDD values between tabs
 */
function syncMdd(origin) {
    const mddAuto = document.getElementById('mddInputAuto');
    const mddManual = document.getElementById('mddInputManual');
    if (!mddAuto || !mddManual) return;
    
    const val = (origin === 'auto') ? mddAuto.value : mddManual.value;
    
    if (origin === 'auto') {
        mddManual.value = val;
    } else {
        mddAuto.value = val;
    }
    
    // Re-run calculations in real-time
    if (activeTab === 'auto') {
        if (activeSubTab === 'mfds') {
            const adiSearchInput = document.getElementById('adiSearchInput');
            if (adiSearchInput && adiSearchInput.value.trim()) {
                runAdiLookup();
            }
        } else if (activeSubTab === 'fda') {
            const fdaSearchInput = document.getElementById('fdaSearchInput');
            if (fdaSearchInput && fdaSearchInput.value.trim()) {
                runFdaLookup();
            }
        } else {
            const smilesInput = document.getElementById('smilesInput');
            if (smilesInput && smilesInput.value.trim()) {
                runPredictCPCA();
            }
        }
    } else {
        runWizardCalculation();
    }
}

/**
 * Extracts numeric value from AI string (e.g. "26.5 ng/day" -> 26.5)
 */
function getNumericAi(aiStr) {
    if (!aiStr) return null;
    const match = aiStr.match(/([0-9\.]+)/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Formats a concentration in ppm and ppb with custom precision
 */
function formatConcentration(ppm) {
    if (ppm >= 1) {
        return `${ppm.toFixed(2)} ppm (${(ppm * 1000).toFixed(0)} ppb)`;
    } else {
        return `${ppm.toFixed(4)} ppm (${(ppm * 1000).toFixed(1)} ppb)`;
    }
}

/**
 * Helper to determine if a string looks like a SMILES code
 * (returns false for common chemical names or Korean queries)
 */
function isSmilesPattern(str) {
    // If it contains Korean characters
    if (/[\uac00-\ud7a3]/.test(str)) return false;
    
    // If it contains spaces
    if (/\s/.test(str)) return false;
    
    // Non-SMILES alphabet letters
    const nonSmilesLetters = /[adeghjkmqrtuwxyzADEGHJKLMQTUVWXYZ]/;
    
    // halogens like Cl and Br contain 'l' and 'r'. We remove them first
    let clean = str.replace(/Cl/g, '').replace(/Br/g, '');
    
    if (nonSmilesLetters.test(clean)) {
        return false;
    }
    
    return true;
}

/**
 * Filters the local official database by search query, and either immediately
 * analyzes a single match or renders a list of choices.
 */
function runTextSearchAnalysis(query, outputArea, placeholder, canvas) {
    const lowercaseQuery = query.toLowerCase();
    const matches = [];
    
    if (window.MFDS_ADI_DATABASE) {
        for (let item of window.MFDS_ADI_DATABASE) {
            const matchName = item.name ? item.name.toLowerCase() : '';
            const matchActive = item.active ? item.active.toLowerCase() : '';
            const matchIupac = item.iupac ? item.iupac.toLowerCase() : '';
            const matchCas = item.cas ? item.cas.toLowerCase() : '';
            
            if (matchName.includes(lowercaseQuery) || 
                matchActive.includes(lowercaseQuery) || 
                matchIupac.includes(lowercaseQuery) ||
                matchCas.includes(lowercaseQuery)) {
                matches.push(item);
            }
        }
    }
    
    if (matches.length === 0) {
        outputArea.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3.5rem; color: var(--color-warning); margin-bottom: 1.5rem;"></i>
                <h3>검색 결과가 없습니다</h3>
                <p>입력하신 <strong>"${query}"</strong>에 부합하는 발생성분 또는 불순물 명칭을 식약처 설정 기준 DB에서 찾을 수 없습니다.</p>
                <small style="margin-top: 1rem; color: var(--text-muted); display: block; margin-bottom: 1rem;">이 물질이 식약처 발표 기준에 등록되지 않은 신규 물질이라면, 구조식을 통해 CPCA 등급을 직접 예측해 보세요.</small>
                <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 0.4rem; margin: 0 auto;" onclick="switchSubTab('predict'); document.getElementById('smilesInput').value = '${isSmilesPattern(query) ? query : ''}';">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> 신규 니트로사민류 예측 탭으로 이동
                </button>
            </div>
        `;
    } else if (matches.length === 1) {
        selectAndAnalyzeItem(matches[0], outputArea, placeholder, canvas);
    } else {
        // Render search result grid
        let listHtml = matches.map(item => {
            const officialCat = item.category ? `Cat ${item.category}` : "N/A";
            const casDisplay = item.cas || "등록 없음";
            return `
                <tr class="search-result-row" onclick="window.selectAndAnalyzeItemByNo(${item.no})">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.active || 'N/A'}</td>
                    <td class="center-text">${casDisplay}</td>
                    <td class="center-text"><span class="badge badge-cat-${item.category || 5}">${officialCat}</span></td>
                    <td class="right-text"><strong>${item.ai} ng/day</strong></td>
                    <td class="center-text">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.selectAndAnalyzeItemByNo(${item.no})">
                            <i class="fa-solid fa-chart-line"></i> 분석
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        outputArea.innerHTML = `
            <div class="search-results-panel">
                <div class="search-results-header">
                    <i class="fa-solid fa-list-ol"></i> 복수 검색 결과 발견 (총 <strong>${matches.length}</strong>건)
                </div>
                <p class="search-results-desc">검색어 <strong>"${query}"</strong>에 매핑되는 식약처 설정 기준 불순물 목록입니다. 분석할 물질을 클릭하세요:</p>
                <div class="table-responsive" style="margin-top: 1rem;">
                    <table class="search-results-table">
                        <thead>
                            <tr>
                                <th>불순물 명칭 (영문)</th>
                                <th>발생 원료 성분</th>
                                <th class="center-text">CAS No.</th>
                                <th class="center-text">식약처 설정 등급</th>
                                <th class="right-text">식약처 설정 허용량</th>
                                <th class="center-text">분석</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${listHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

/**
 * Click handler from dynamic HTML table row
 */
function selectAndAnalyzeItemByNo(no) {
    if (!window.MFDS_ADI_DATABASE) return;
    const item = window.MFDS_ADI_DATABASE.find(x => x.no === no);
    if (!item) return;
    
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    
    // Update input box value
    document.getElementById('adiSearchInput').value = item.cas || item.name;
    
    selectAndAnalyzeItem(item, outputArea, placeholder, canvas);
}

/**
 * Resolves chemical structure (SMILES) and displays compared results side-by-side
 */
function selectAndAnalyzeItem(item, outputArea, placeholder, canvas) {
    outputArea.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3.5rem; color: var(--color-primary); margin-bottom: 1.5rem;"></i>
            <h3>화학 구조 정보 조회 및 분석 중...</h3>
            <p>선택하신 불순물 <strong>${item.name}</strong>의 2D 구조 정보를 PubChem에서 가져오고 있습니다.</p>
        </div>
    `;
    
    const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
    const hasMdd = !isNaN(mddVal);
    
    // Resolve SMILES: Try CAS first, then Name
    const queryTerm = item.cas || item.name;
    
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/chemical/name/${encodeURIComponent(queryTerm)}/property/CanonicalSMILES/JSON`)
        .then(response => {
            if (!response.ok) throw new Error("Resolution failed");
            return response.json();
        })
        .then(data => {
            const properties = data.PropertyTable?.Properties?.[0];
            const smiles = properties?.CanonicalSMILES;
            if (!smiles) throw new Error("No SMILES in response");
            
            // Run CPCA engine
            const result = window.calculateCPCA(smiles);
            
            lastAutoResult = {
                smiles: smiles,
                targetName: item.name,
                mdd: hasMdd ? mddVal : null,
                ...result,
                casMatch: item,
                queryCas: item.cas
            };
            
            // Draw structure
            drawSmilesStructure(smiles, placeholder, canvas, result);
            
            // Display Results
            renderResults(outputArea, lastAutoResult);
            
            // Sync to JSME if visible
            if (jsmeApplet && document.getElementById('jsmeContainer').style.display !== 'none') {
                jsmeApplet.readGenericMolecularInput(smiles);
            }
        })
        .catch(err => {
            console.error("Structure resolution failed: ", err);
            
            // Fallback: Display local official ADI details without structure
            lastAutoResult = {
                smiles: "N/A (구조식 조회 실패)",
                targetName: item.name,
                success: true,
                category: item.category,
                score: null,
                ai: item.ai ? `${item.ai} ng/day` : "식약처 설정 기준",
                mdd: hasMdd ? mddVal : null,
                messages: [
                    `식약처 1일 섭취허용량 기준 목록 등록 확인 (연번: ${item.no})`,
                    `발생 성분: ${item.active || '해당 없음'}`,
                    `식약처 설정 섭취허용량: ${item.ai} ng/day (CPCA Category ${item.category || 'N/A'})`,
                    `비고 (산출 근거): ${item.remark || '없음'}`,
                    `발표일자: ${item.date || 'N/A'}`
                ],
                patternsCount: 0,
                casMatch: item,
                queryCas: item.cas
            };
            
            // Clear canvas and show placeholder
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fa-solid fa-circle-info" style="color: var(--color-primary)"></i>
                <p>구조식 시각화 실패<br><small>오프라인 상태이거나 PubChem에 구조 정보가 없습니다.</small></p>
            `;
            
            renderResults(outputArea, lastAutoResult);
        });
}

// FDA Lookup Functions
function runFdaLookup() {
    const fdaSearchInput = document.getElementById('fdaSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    
    if (!fdaSearchInput || !outputArea) return;
    
    const inputVal = fdaSearchInput.value.trim();
    if (!inputVal) {
        alert("불순물 명칭 또는 발생성분을 입력해 주세요.");
        return;
    }
    
    runFdaTextSearchAnalysis(inputVal, outputArea, placeholder, canvas);
}

function runFdaTextSearchAnalysis(query, outputArea, placeholder, canvas) {
    const lowercaseQuery = query.toLowerCase();
    const matches = [];
    
    if (window.FDA_ADI_DATABASE) {
        for (let item of window.FDA_ADI_DATABASE) {
            const matchName = item.name ? item.name.toLowerCase() : '';
            const matchApi = item.api ? item.api.toLowerCase() : '';
            
            if (matchName.includes(lowercaseQuery) || matchApi.includes(lowercaseQuery)) {
                matches.push(item);
            }
        }
    }
    
    if (matches.length === 0) {
        outputArea.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3.5rem; color: var(--color-warning); margin-bottom: 1.5rem;"></i>
                <h3>검색 결과가 없습니다</h3>
                <p>입력하신 <strong>"${query}"</strong>에 부합하는 발생성분 또는 불순물 명칭을 FDA 설정 기준 DB에서 찾을 수 없습니다.</p>
                <small style="margin-top: 1rem; color: var(--text-muted); display: block; margin-bottom: 1rem;">FDA 고시 목록에 없는 불순물입니다. [신규 니트로사민류 예측] 탭에서 SMILES로 CPCA 등급을 산출하세요.</small>
                <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 0.4rem; margin: 0 auto;" onclick="switchSubTab('predict'); document.getElementById('smilesInput').value = '${isSmilesPattern(query) ? query : ''}';">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> 신규 니트로사민류 예측 탭으로 이동
                </button>
            </div>
        `;
    } else if (matches.length === 1) {
        selectAndAnalyzeFdaItem(matches[0], outputArea, placeholder, canvas);
    } else {
        let listHtml = matches.map(item => {
            const officialCat = item.category ? `Cat ${item.category}` : "N/A";
            return `
                <tr class="search-result-row" onclick="window.selectAndAnalyzeFdaItemByNo(${item.id})">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.api || 'N/A'}</td>
                    <td class="center-text"><span class="badge badge-cat-${item.category || 5}">${officialCat}</span></td>
                    <td class="right-text"><strong>${item.ai} ng/day</strong></td>
                    <td class="center-text">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.selectAndAnalyzeFdaItemByNo(${item.id})">
                            <i class="fa-solid fa-chart-line"></i> 분석
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        outputArea.innerHTML = `
            <div class="search-results-panel">
                <div class="search-results-header">
                    <i class="fa-solid fa-list-ol"></i> 복수 검색 결과 발견 (총 <strong>${matches.length}</strong>건)
                </div>
                <p class="search-results-desc">검색어 <strong>"${query}"</strong>에 매핑되는 FDA 설정 기준 불순물 목록입니다. 분석할 물질을 클릭하세요:</p>
                <div class="table-responsive" style="margin-top: 1rem;">
                    <table class="search-results-table">
                        <thead>
                            <tr>
                                <th>불순물 명칭 (영문)</th>
                                <th>발생 원료 성분</th>
                                <th class="center-text">FDA 설정 등급</th>
                                <th class="right-text">FDA 설정 허용량</th>
                                <th class="center-text">분석</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${listHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

function selectAndAnalyzeFdaItemByNo(id) {
    if (!window.FDA_ADI_DATABASE) return;
    const item = window.FDA_ADI_DATABASE.find(x => x.id === id);
    if (!item) return;
    
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    
    document.getElementById('fdaSearchInput').value = item.name;
    
    selectAndAnalyzeFdaItem(item, outputArea, placeholder, canvas);
}

function selectAndAnalyzeFdaItem(item, outputArea, placeholder, canvas) {
    outputArea.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3.5rem; color: var(--color-primary); margin-bottom: 1.5rem;"></i>
            <h3>화학 구조 정보 조회 및 분석 중...</h3>
            <p>선택하신 불순물 <strong>${item.name}</strong>의 2D 구조 정보를 PubChem에서 가져오고 있습니다.</p>
        </div>
    `;
    
    const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
    const hasMdd = !isNaN(mddVal);
    
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/chemical/name/${encodeURIComponent(item.name)}/property/CanonicalSMILES/JSON`)
        .then(response => {
            if (!response.ok) throw new Error("Resolution failed");
            return response.json();
        })
        .then(data => {
            const properties = data.PropertyTable?.Properties?.[0];
            const smiles = properties?.CanonicalSMILES;
            if (!smiles) throw new Error("No SMILES in response");
            
            const result = window.calculateCPCA(smiles);
            
            lastAutoResult = {
                smiles: smiles,
                targetName: item.name,
                mdd: hasMdd ? mddVal : null,
                ...result,
                fdaMatch: item
            };
            
            drawSmilesStructure(smiles, placeholder, canvas, result);
            renderResults(outputArea, lastAutoResult);
            
            if (jsmeApplet && document.getElementById('jsmeContainer').style.display !== 'none') {
                jsmeApplet.readGenericMolecularInput(smiles);
            }
        })
        .catch(err => {
            console.error("Structure resolution failed: ", err);
            
            lastAutoResult = {
                smiles: "N/A (구조식 조회 실패)",
                targetName: item.name,
                success: true,
                category: item.category,
                score: null,
                ai: item.ai ? `${item.ai} ng/day` : "FDA 설정 기준",
                mdd: hasMdd ? mddVal : null,
                messages: [
                    `FDA 1일 섭취허용량 기준 목록 등록 확인 (연번: ${item.id})`,
                    `발생 성분: ${item.api || '해당 없음'}`,
                    `FDA 설정 섭취허용량: ${item.ai} ng/day (CPCA Category ${item.category || 'N/A'})`
                ],
                patternsCount: 0,
                fdaMatch: item
            };
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fa-solid fa-circle-info" style="color: var(--color-primary)"></i>
                <p>구조식 시각화 실패<br><small>오프라인 상태이거나 PubChem에 구조 정보가 없습니다.</small></p>
            `;
            
            renderResults(outputArea, lastAutoResult);
        });
}

// Expose selection methods to global window namespace
window.selectAndAnalyzeItemByNo = selectAndAnalyzeItemByNo;
window.selectAndAnalyzeItem = selectAndAnalyzeItem;
window.selectAndAnalyzeFdaItemByNo = selectAndAnalyzeFdaItemByNo;
window.selectAndAnalyzeFdaItem = selectAndAnalyzeFdaItem;
window.runFdaLookup = runFdaLookup;
