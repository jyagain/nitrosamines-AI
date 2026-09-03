// CPCA Calculator Main Frontend Script

// Initialize RDKit-JS WebAssembly module
if (window.initRDKitModule) {
    window.initRDKitModule().then(function(instance) {
        window.RDKit = instance;
        console.log("RDKit-JS successfully initialized. Version: " + instance.version());
    }).catch(function(err) {
        console.error("Failed to initialize RDKit-JS:", err);
    });
} else {
    console.error("initRDKitModule not found. Verify CDN is loaded correctly.");
}

let activeTab = 'auto'; // 'auto' or 'manual'
let activeSubTab = 'mfds'; // 'mfds', 'fda', or 'predict'
let lastAutoResult = null;
let lastWizardResult = null;
let jsmeApplet = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial state: run wizard calculation once to display default result
    runWizardCalculation();
    
    // 3. Bind enter key on input fields
    const bindEnter = (id, fn) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') fn();
            });
        }
    };
    
    bindEnter('adiSearchInput', runAdiLookup);
    bindEnter('fdaSearchInput', runFdaLookup);
    bindEnter('emaSearchInput', runEmaLookup);
    bindEnter('hcSearchInput', runHcLookup);
    bindEnter('tgaSearchInput', runTgaLookup);
    bindEnter('smilesInput', runPredictCPCA);
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
    const btnEma = document.getElementById('subTabBtnEma');
    const btnHc = document.getElementById('subTabBtnHc');
    const btnTga = document.getElementById('subTabBtnTga');
    const btnPredict = document.getElementById('subTabBtnPredict');
    
    const contentMfds = document.getElementById('subTabContentMfds');
    const contentFda = document.getElementById('subTabContentFda');
    const contentEma = document.getElementById('subTabContentEma');
    const contentHc = document.getElementById('subTabContentHc');
    const contentTga = document.getElementById('subTabContentTga');
    const contentPredict = document.getElementById('subTabContentPredict');
    
    // Deactivate all
    [btnMfds, btnFda, btnEma, btnHc, btnTga, btnPredict].forEach(btn => btn && btn.classList.remove('active'));
    [contentMfds, contentFda, contentEma, contentHc, contentTga, contentPredict].forEach(c => c && c.classList.remove('active'));
    
    if (subTab === 'mfds') {
        if (btnMfds) btnMfds.classList.add('active');
        if (contentMfds) contentMfds.classList.add('active');
    } else if (subTab === 'fda') {
        if (btnFda) btnFda.classList.add('active');
        if (contentFda) contentFda.classList.add('active');
    } else if (subTab === 'ema') {
        if (btnEma) btnEma.classList.add('active');
        if (contentEma) contentEma.classList.add('active');
    } else if (subTab === 'hc') {
        if (btnHc) btnHc.classList.add('active');
        if (contentHc) contentHc.classList.add('active');
    } else if (subTab === 'tga') {
        if (btnTga) btnTga.classList.add('active');
        if (contentTga) contentTga.classList.add('active');
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
                    <i class="fa-solid fa-triangle-exclamation"></i> 주의: 규제 기관 설정 자체 독성값 존재 물질
                </div>
                <div class="alert-body">
                    이 물질은 규제 기관(식약처/EMA/FDA/HC/TGA)에서 발암성 연구 데이터를 기반으로 별도 지정한 <strong>자체 독성값(Compound-Specific AI)</strong>이 존재합니다.<br>
                    따라서 CPCA 분류 등급을 적용하지 않으며, 공식 발표 기준치인 <strong>${result.compoundSpecific.ai}</strong>를 우선 준수해야 합니다.
                </div>
            </div>
        `;
    }
    
    // Build 5-Agency Comparison Summary Card
    const multiMatches = result.multiMatches || findMultiAgencyMatches(
        result.targetName,
        result.queryCas || result.casMatch?.cas || result.fdaMatch?.cas || result.agencyMatch?.cas,
        result.casMatch?.active || result.fdaMatch?.api || result.agencyMatch?.active
    );
    const multiComparisonHtml = buildMultiAgencyCardHtml(multiMatches, activeSubTab);

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
                                    <th>조치 및 대응 요구사항 (규제 기관 권장)</th>
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
                                    <td><strong>${formatConcentration(limitPpm)} 초과 초과</strong></td>
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
            ${multiComparisonHtml}
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
    
    const modeMap = {
        mfds: "식약처(MFDS) 고시 1일 섭취허용량 기준 조회",
        fda: "US FDA 고시 1일 섭취허용량 기준 조회",
        ema: "EMA(유럽 의약품청) 고시 1일 섭취허용량 기준 조회",
        hc: "Health Canada(캐나다) 고시 1일 섭취허용량 기준 조회",
        tga: "TGA(호주 식약청) 고시 1일 섭취허용량 기준 조회",
        predict: "신규 니트로사민류 CPCA 직접 예측"
    };
    let modeText = activeTab === 'auto' ? (modeMap[activeSubTab] || "자동 분석기") : "자가진단 수동 위자드";
    
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
                <strong>[주의] 규제 기관 설정 자체 독성값 존재 물질 (CPCA 분류 예외)</strong><br>
                본 물질은 규제 기관(식약처/EMA/FDA/HC/TGA)에서 발암성 데이터를 기반으로 별도 지정한 '화합물 특이적 섭취허용량(Compound-Specific AI)'이 존재합니다.<br>
                따라서 CPCA 분류법(Category 1~5)을 적용하지 않으며, 공식 발표 기준치인 <strong>${result.compoundSpecific.ai}</strong>를 우선 준수해야 합니다.
            `;
        } else {
            printWarningArea.style.display = 'none';
        }
    }
    
    // 2c. Populate Print CAS Comparison Area & Multi-Agency Print Grid
    const printCasArea = document.getElementById('printCasComparisonArea');
    if (printCasArea) {
        const matches = result.multiMatches || findMultiAgencyMatches(
            result.targetName,
            result.queryCas || result.casMatch?.cas || result.agencyMatch?.cas,
            result.casMatch?.active || result.agencyMatch?.active
        );
        
        let printTableRows = [];
        if (matches.mfds) printTableRows.push(`<tr><th>식약처(MFDS)</th><td>AI: <strong>${matches.mfds.ai} ng/day</strong></td><td>${matches.mfds.category ? 'Cat ' + matches.mfds.category : '자체 AI'}</td><td>-</td></tr>`);
        if (matches.fda) printTableRows.push(`<tr><th>US FDA</th><td>AI: <strong>${matches.fda.ai} ng/day</strong></td><td>${matches.fda.category ? 'Cat ' + matches.fda.category : matches.fda.sourceType}</td><td>-</td></tr>`);
        if (matches.ema) printTableRows.push(`<tr><th>EMA (유럽)</th><td>AI: <strong>${matches.ema.ai} ng/day</strong></td><td>${matches.ema.category ? 'Cat ' + matches.ema.category : '자체 AI'}</td><td>-</td></tr>`);
        if (matches.hc) printTableRows.push(`<tr><th>Health Canada</th><td>AI: <strong>${matches.hc.ai} ng/day</strong></td><td>${matches.hc.category ? 'Cat ' + matches.hc.category : '자체 AI'}</td><td>-</td></tr>`);
        if (matches.tga) printTableRows.push(`<tr><th>TGA (호주)</th><td>AI: <strong>${matches.tga.ai} ng/day</strong></td><td>${matches.tga.category ? 'Cat ' + matches.tga.category : '자체 AI'}</td><td>${matches.tga.link ? `<a href="${matches.tga.link}" class="print-hyperlink" target="_blank">TGA GSRS 링크</a>` : '-'}</td></tr>`);
        
        if (printTableRows.length > 0) {
            printCasArea.style.display = 'block';
            printCasArea.innerHTML = `
                <strong>[글로벌 5대 규제 기관 고시 비교 현황]</strong>
                <table style="width:100%; margin-top:8px; border-collapse:collapse; font-size:8.5pt;">
                    <thead><tr style="background:#f1f5f9;"><th>기관명</th><th>섭취허용량 (AI)</th><th>설정 등급</th><th>출처 하이퍼링크</th></tr></thead>
                    <tbody>${printTableRows.join('')}</tbody>
                </table>
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
 * Draws the molecular structure using RDKit-JS and highlights the nitrosamine group
 */
function drawSmilesStructure(smiles, placeholder, canvas, result) {
    if (result.success && window.RDKit) {
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        
        let mol = null;
        let qmol = null;
        try {
            mol = window.RDKit.get_mol(smiles);
            if (!mol) {
                showDrawingError();
                return;
            }
            
            // Nitrosamine pattern query for highlight: O=NN
            qmol = window.RDKit.get_qmol("O=NN");
            let matchDetails = "";
            if (qmol) {
                matchDetails = mol.get_substruct_match(qmol);
            }
            
            // Clear canvas context
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw to canvas with highlights if nitrosamine found
            if (matchDetails && matchDetails !== "{}" && matchDetails !== "") {
                mol.draw_to_canvas_with_highlights(canvas, matchDetails);
            } else {
                mol.draw_to_canvas(canvas, -1, -1);
            }
        } catch (e) {
            console.error("RDKit structure drawing error: ", e);
            showDrawingError();
        } finally {
            if (mol) mol.delete();
            if (qmol) qmol.delete();
        }
    } else {
        // Clear canvas and show placeholder on failure
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger)"></i>
            <p>구조를 시각화할 수 없습니다.<br><small>${result.error || '유효하지 않은 SMILES 또는 화학 엔진 로딩 중'}</small></p>
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
    
    // Non-SMILES alphabet letters (relaxed to allow H, K, a, d, etc.)
    const nonSmilesLetters = /[eghjmqrtuwxyzEGJMQRTUVWXY]/;
    
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
let currentFdaFilter = 'ALL';

function setFdaFilter(type) {
    currentFdaFilter = type;
    document.querySelectorAll('.fda-filter-group .btn').forEach(btn => btn.classList.remove('active'));
    if (type === 'ALL') document.getElementById('fdaFilterAll')?.classList.add('active');
    if (type === 'CPCA') document.getElementById('fdaFilterCpca')?.classList.add('active');
    if (type === 'SAR') document.getElementById('fdaFilterSar')?.classList.add('active');
    if (type === 'Interim') document.getElementById('fdaFilterInterim')?.classList.add('active');

    const fdaSearchInput = document.getElementById('fdaSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');

    const inputVal = fdaSearchInput ? fdaSearchInput.value.trim() : '';
    if (inputVal) {
        runFdaTextSearchAnalysis(inputVal, outputArea, placeholder, canvas);
    }
}

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
            if (currentFdaFilter !== 'ALL' && item.sourceType !== currentFdaFilter) {
                continue;
            }

            const matchName = item.name ? item.name.toLowerCase() : '';
            const matchApi = item.api ? item.api.toLowerCase() : '';
            const matchSurrogate = item.surrogate ? item.surrogate.toLowerCase() : '';
            
            if (matchName.includes(lowercaseQuery) || matchApi.includes(lowercaseQuery) || matchSurrogate.includes(lowercaseQuery)) {
                matches.push(item);
            }
        }
    }
    
    if (matches.length === 0) {
        const filterMsg = currentFdaFilter !== 'ALL' ? ` [${currentFdaFilter} 필터 적용 중]` : '';
        outputArea.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3.5rem; color: var(--color-warning); margin-bottom: 1.5rem;"></i>
                <h3>검색 결과가 없습니다${filterMsg}</h3>
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
            const sourceType = item.sourceType || 'CPCA';
            const sourceBadgeClass = `badge-source-${sourceType.toLowerCase()}`;
            
            let catDisplay = "N/A";
            if (item.category) {
                catDisplay = `<span class="badge badge-cat-${item.category}">Cat ${item.category}</span>`;
            } else if (sourceType === 'SAR') {
                catDisplay = `<span style="font-size:0.8rem; color:var(--text-secondary);">참조: ${item.surrogate || 'SAR'}</span>`;
            } else if (sourceType === 'Interim') {
                catDisplay = `<span style="font-size:0.8rem; color:var(--text-secondary);">Interim: ${item.interimLimitPpm || 'N/A'}</span>`;
            }

            return `
                <tr class="search-result-row" onclick="window.selectAndAnalyzeFdaItemByNo(${item.id})">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.api || 'N/A'}</td>
                    <td class="center-text"><span class="${sourceBadgeClass}">FDA ${sourceType}</span></td>
                    <td class="center-text">${catDisplay}</td>
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
                <div class="search-results-header" style="display: flex; align-items: center; justify-content: space-between;">
                    <span><i class="fa-solid fa-list-ol"></i> 복수 검색 결과 발견 (총 <strong>${matches.length}</strong>건)</span>
                    <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 20px;"><i class="fa-regular fa-calendar-check"></i> FDA 2026.08 공고 기준</span>
                </div>
                <p class="search-results-desc">검색어 <strong>"${query}"</strong>에 매핑되는 FDA 설정 기준 불순물 목록입니다. 분석할 물질을 클릭하세요:</p>
                <div class="table-responsive" style="margin-top: 1rem;">
                    <table class="search-results-table">
                        <thead>
                            <tr>
                                <th>불순물 명칭 (영문)</th>
                                <th>발생 원료 성분</th>
                                <th class="center-text">근거 기준</th>
                                <th class="center-text">FDA 설정 등급 / 비고</th>
                                <th class="right-text">FDA 섭취허용량</th>
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
            
            let messageDetails = [
                `FDA 1일 섭취허용량 기준 목록 등록 확인 (연번: ${item.id})`,
                `공고 기준: ${item.publishDate || '2026년 8월 공고'}`,
                `발생 성분: ${item.api || '해당 없음'}`
            ];

            if (item.sourceType === 'SAR') {
                messageDetails.push(`FDA 설정 섭취허용량: ${item.ai} ng/day (SAR / Read-Across, 참조물질: ${item.surrogate || 'N/A'})`);
            } else if (item.sourceType === 'Interim') {
                messageDetails.push(`FDA 한시적 섭취허용량: ${item.ai} ng/day (Interim Limit: ${item.interimLimitPpm || 'N/A'}, 기한: ${item.estimatedDuration || 'N/A'})`);
            } else {
                messageDetails.push(`FDA 설정 섭취허용량: ${item.ai} ng/day (CPCA Category ${item.category || 'N/A'})`);
            }

            lastAutoResult = {
                smiles: "N/A (구조식 조회 실패)",
                targetName: item.name,
                success: true,
                category: item.category,
                score: null,
                ai: item.ai ? `${item.ai} ng/day` : "FDA 설정 기준",
                mdd: hasMdd ? mddVal : null,
                messages: messageDetails,
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
window.setFdaFilter = setFdaFilter;
window.runFdaLookup = runFdaLookup;
window.runEmaLookup = runEmaLookup;
window.runHcLookup = runHcLookup;
window.runTgaLookup = runTgaLookup;
window.selectAndAnalyzeItemByNo = selectAndAnalyzeItemByNo;
window.selectAndAnalyzeItem = selectAndAnalyzeItem;
window.selectAndAnalyzeFdaItemByNo = selectAndAnalyzeFdaItemByNo;
window.selectAndAnalyzeFdaItem = selectAndAnalyzeFdaItem;
window.selectAndAnalyzeAgencyItemByNo = selectAndAnalyzeAgencyItemByNo;
window.selectAndAnalyzeAgencyItem = selectAndAnalyzeAgencyItem;
window.handleSearchAutocomplete = handleSearchAutocomplete;
window.selectAutocompleteItem = selectAutocompleteItem;

/**
 * Searches across all 5 databases (MFDS, FDA, EMA, HC, TGA) for cross-agency comparison
 */
function findMultiAgencyMatches(targetName, targetCas, targetActive) {
    const cleanCas = (targetCas || '').trim().toLowerCase();
    const cleanName = (targetName || '').trim().toLowerCase();
    const cleanActive = (targetActive || '').trim().toLowerCase();

    function matchInDb(db) {
        if (!db || (!cleanCas && !cleanName && !cleanActive)) return null;
        return db.find(item => {
            const itemCas = (item.cas || '').toLowerCase();
            const itemName = (item.name || '').toLowerCase();
            const itemActive = (item.active || item.api || '').toLowerCase();

            if (cleanCas && itemCas && (cleanCas === itemCas || itemCas.includes(cleanCas))) return true;
            if (cleanName && itemName && (cleanName === itemName || itemName.includes(cleanName) || cleanName.includes(itemName))) return true;
            if (cleanActive && itemActive && (cleanActive === itemActive || itemActive.includes(cleanActive))) return true;
            return false;
        });
    }

    return {
        mfds: matchInDb(window.MFDS_ADI_DATABASE),
        fda: matchInDb(window.FDA_ADI_DATABASE),
        ema: matchInDb(window.EMA_ADI_DATABASE),
        hc: matchInDb(window.HC_ADI_DATABASE),
        tga: matchInDb(window.TGA_ADI_DATABASE)
    };
}

/**
 * Builds HTML for 5-Agency Comparison Summary Card
 */
function buildMultiAgencyCardHtml(matches, activeSubTab) {
    if (!matches) return '';
    const { mfds, fda, ema, hc, tga } = matches;
    if (!mfds && !fda && !ema && !hc && !tga) return '';

    function renderAgencyCol(title, iconClass, match, isCurrent) {
        const activeClass = isCurrent ? 'active-agency' : '';
        if (!match) {
            return `
                <div class="agency-card-item no-data ${activeClass}">
                    <div class="agency-title"><i class="fa-solid ${iconClass}"></i> ${title}</div>
                    <div class="agency-ai" style="color:var(--text-muted); font-size:0.95rem;">미설정</div>
                    <div class="agency-cat" style="color:var(--text-muted);">-</div>
                </div>
            `;
        }

        const catStr = match.category ? `Cat ${match.category}` : (match.sourceType || '자체 AI');
        const linkBtn = match.link ? `<a href="${match.link}" target="_blank" class="source-link-btn" title="출처 링크"><i class="fa-solid fa-arrow-up-right-from-square"></i> GSRS</a>` : '';

        return `
            <div class="agency-card-item has-data ${activeClass}">
                <div class="agency-title"><i class="fa-solid ${iconClass}"></i> ${title}</div>
                <div class="agency-ai">${match.ai} <small style="font-size:0.7rem;">ng/day</small></div>
                <div class="agency-cat"><span class="badge badge-cat-${match.category || 5}">${catStr}</span></div>
                ${linkBtn}
            </div>
        `;
    }

    return `
        <div class="comparison-card-5grid">
            <div class="comparison-grid-header">
                <span style="font-weight: 700; color: #0f172a; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                    <i class="fa-solid fa-globe" style="color: var(--color-primary);"></i> 5대 글로벌 규제 기관 (MFDS · US FDA · EMA · HC · TGA) 비교 요약
                </span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #047857; font-size: 0.78rem;">실시간 연동 비교</span>
            </div>
            <div class="agency-cards-container">
                ${renderAgencyCol('식약처(MFDS)', 'fa-building-shield', mfds, activeSubTab === 'mfds')}
                ${renderAgencyCol('US FDA', 'fa-flag-usa', fda, activeSubTab === 'fda')}
                ${renderAgencyCol('EMA (유럽)', 'fa-landmark', ema, activeSubTab === 'ema')}
                ${renderAgencyCol('Health Canada', 'fa-leaf', hc, activeSubTab === 'hc')}
                ${renderAgencyCol('TGA (호주)', 'fa-earth-oceania', tga, activeSubTab === 'tga')}
            </div>
        </div>
    `;
}

/**
 * Real-time autocomplete search handler for regulatory agency inputs
 */
function handleSearchAutocomplete(e, agency) {
    const query = e.target.value.trim().toLowerCase();
    const dropdownId = agency === 'mfds' ? 'mfdsAutocomplete' : (agency + 'Autocomplete');
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    if (query.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    let db = [];
    if (agency === 'mfds') db = window.MFDS_ADI_DATABASE || [];
    else if (agency === 'fda') db = window.FDA_ADI_DATABASE || [];
    else if (agency === 'ema') db = window.EMA_ADI_DATABASE || [];
    else if (agency === 'hc') db = window.HC_ADI_DATABASE || [];
    else if (agency === 'tga') db = window.TGA_ADI_DATABASE || [];

    const matches = db.filter(item => {
        const name = (item.name || '').toLowerCase();
        const active = (item.active || item.api || '').toLowerCase();
        const cas = (item.cas || '').toLowerCase();
        return name.includes(query) || active.includes(query) || cas.includes(query);
    }).slice(0, 8);

    if (matches.length === 0) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    const agencyLabels = {
        mfds: '식약처',
        fda: 'US FDA',
        ema: 'EMA',
        hc: 'HC',
        tga: 'TGA'
    };

    dropdown.innerHTML = matches.map(item => {
        const casText = item.cas ? ` (CAS: ${item.cas})` : '';
        const sourceText = item.active || item.api ? ` | 성분: ${item.active || item.api}` : '';
        const catText = item.category ? ` [Cat ${item.category}]` : '';
        const safeName = (item.name || '').replace(/'/g, "\\'");

        return `
            <div class="autocomplete-item" onclick="selectAutocompleteItem('${agency}', '${safeName}', '${item.id || item.no}')">
                <div class="item-title">
                    <span class="badge" style="font-size:0.7rem; background:#0284c7; color:#fff; padding:0.1rem 0.4rem;">${agencyLabels[agency]}</span>
                    <span>${item.name}</span>
                </div>
                <div class="item-sub">${item.ai} ng/day${catText}${casText}${sourceText}</div>
            </div>
        `;
    }).join('');

    dropdown.style.display = 'block';
}

function selectAutocompleteItem(agency, name, id) {
    const inputId = agency === 'mfds' ? 'adiSearchInput' : (agency + 'SearchInput');
    const dropdownId = agency === 'mfds' ? 'mfdsAutocomplete' : (agency + 'Autocomplete');
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (input) input.value = name;
    if (dropdown) dropdown.style.display = 'none';

    if (agency === 'mfds') runAdiLookup();
    else if (agency === 'fda') runFdaLookup();
    else if (agency === 'ema') runEmaLookup();
    else if (agency === 'hc') runHcLookup();
    else if (agency === 'tga') runTgaLookup();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group')) {
        document.querySelectorAll('.autocomplete-dropdown').forEach(el => el.style.display = 'none');
    }
});

/**
 * EMA, Health Canada, TGA Lookups
 */
function runEmaLookup() {
    const searchInput = document.getElementById('emaSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    if (!searchInput || !outputArea) return;

    const query = searchInput.value.trim();
    if (!query) {
        alert("EMA 불순물명, 주성분(Source) 또는 CAS 번호를 입력해 주세요.");
        return;
    }
    runAgencyTextSearch('ema', query, window.EMA_ADI_DATABASE, outputArea, placeholder, canvas);
}

function runHcLookup() {
    const searchInput = document.getElementById('hcSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    if (!searchInput || !outputArea) return;

    const query = searchInput.value.trim();
    if (!query) {
        alert("Health Canada 불순물명, 주성분(Drug Substance) 또는 CAS 번호를 입력해 주세요.");
        return;
    }
    runAgencyTextSearch('hc', query, window.HC_ADI_DATABASE, outputArea, placeholder, canvas);
}

function runTgaLookup() {
    const searchInput = document.getElementById('tgaSearchInput');
    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');
    if (!searchInput || !outputArea) return;

    const query = searchInput.value.trim();
    if (!query) {
        alert("TGA 불순물명, 주성분(Source) 또는 CAS 번호를 입력해 주세요.");
        return;
    }
    runAgencyTextSearch('tga', query, window.TGA_ADI_DATABASE, outputArea, placeholder, canvas);
}

function runAgencyTextSearch(agencyKey, query, db, outputArea, placeholder, canvas) {
    const lowercaseQuery = query.toLowerCase();
    const matches = [];
    const agencyNames = { ema: 'EMA', hc: 'Health Canada', tga: 'TGA' };
    const agencyName = agencyNames[agencyKey] || agencyKey.toUpperCase();

    if (db) {
        for (let item of db) {
            const matchName = (item.name || '').toLowerCase();
            const matchActive = (item.active || item.api || '').toLowerCase();
            const matchCas = (item.cas || '').toLowerCase();

            if (matchName.includes(lowercaseQuery) || matchActive.includes(lowercaseQuery) || matchCas.includes(lowercaseQuery)) {
                matches.push(item);
            }
        }
    }

    if (matches.length === 0) {
        outputArea.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3.5rem; color: var(--color-warning); margin-bottom: 1.5rem;"></i>
                <h3>검색 결과가 없습니다</h3>
                <p>입력하신 <strong>"${query}"</strong>에 부합하는 불순물명 또는 발생성분을 ${agencyName} 설정 기준 DB에서 찾을 수 없습니다.</p>
                <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 0.4rem; margin: 1rem auto 0 auto;" onclick="switchSubTab('predict'); document.getElementById('smilesInput').value = '${isSmilesPattern(query) ? query : ''}';">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> 신규 니트로사민류 예측 탭으로 이동
                </button>
            </div>
        `;
    } else if (matches.length === 1) {
        selectAndAnalyzeAgencyItem(agencyKey, matches[0], outputArea, placeholder, canvas);
    } else {
        let listHtml = matches.map(item => {
            const catDisplay = item.category ? `<span class="badge badge-cat-${item.category}">Cat ${item.category}</span>` : 'N/A';
            const casDisplay = item.cas || '등록 없음';
            const linkBtn = item.link ? `<a href="${item.link}" target="_blank" class="source-link-btn" onclick="event.stopPropagation();"><i class="fa-solid fa-arrow-up-right-from-square"></i> 출처</a>` : '';

            return `
                <tr class="search-result-row" onclick="window.selectAndAnalyzeAgencyItemByNo('${agencyKey}', ${item.id})">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.active || item.api || 'N/A'}</td>
                    <td class="center-text">${casDisplay}</td>
                    <td class="center-text">${catDisplay}</td>
                    <td class="right-text"><strong>${item.ai} ng/day</strong></td>
                    <td class="center-text">${linkBtn}</td>
                </tr>
            `;
        }).join('');

        outputArea.innerHTML = `
            <div class="search-results-panel">
                <div class="search-results-header" style="display: flex; align-items: center; justify-content: space-between;">
                    <span><i class="fa-solid fa-list-ol"></i> ${agencyName} DB 복수 검색 결과 (총 <strong>${matches.length}</strong>건)</span>
                    <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 20px;">${agencyName} 공식 DB</span>
                </div>
                <p class="search-results-desc">검색어 <strong>"${query}"</strong>에 매핑되는 불순물 목록입니다. 분석할 항목을 클릭하세요:</p>
                <div class="table-responsive" style="margin-top: 1rem;">
                    <table class="search-results-table">
                        <thead>
                            <tr>
                                <th>불순물 명칭</th>
                                <th>발생 원료 성분</th>
                                <th class="center-text">CAS No.</th>
                                <th class="center-text">설정 등급</th>
                                <th class="right-text">1일 허용량 (AI)</th>
                                <th class="center-text">출처 링크</th>
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

function selectAndAnalyzeAgencyItemByNo(agencyKey, id) {
    let db = [];
    if (agencyKey === 'ema') db = window.EMA_ADI_DATABASE;
    else if (agencyKey === 'hc') db = window.HC_ADI_DATABASE;
    else if (agencyKey === 'tga') db = window.TGA_ADI_DATABASE;
    if (!db) return;

    const item = db.find(x => x.id === id);
    if (!item) return;

    const searchInput = document.getElementById(agencyKey + 'SearchInput');
    if (searchInput) searchInput.value = item.name;

    const outputArea = document.getElementById('resultOutputArea');
    const placeholder = document.getElementById('canvasPlaceholder');
    const canvas = document.getElementById('smilesCanvas');

    selectAndAnalyzeAgencyItem(agencyKey, item, outputArea, placeholder, canvas);
}

function selectAndAnalyzeAgencyItem(agencyKey, item, outputArea, placeholder, canvas) {
    const agencyNames = { ema: 'EMA', hc: 'Health Canada', tga: 'TGA' };
    const agencyName = agencyNames[agencyKey] || agencyKey.toUpperCase();

    outputArea.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3.5rem; color: var(--color-primary); margin-bottom: 1.5rem;"></i>
            <h3>화학 구조 정보 조회 및 5개 기관 통합 비교 분석 중...</h3>
            <p>선택하신 불순물 <strong>${item.name}</strong>의 정보를 조회하고 있습니다.</p>
        </div>
    `;

    const mddVal = parseFloat(document.getElementById('mddInputAuto').value);
    const hasMdd = !isNaN(mddVal);

    const smilesQuery = item.smiles || item.cas || item.name;

    function processItemWithSmiles(smiles) {
        const cpcaResult = smiles ? window.calculateCPCA(smiles) : { success: true, category: item.category || 5, score: null, ai: item.ai + " ng/day", messages: [`${agencyName} 공식 발표 데이터 조회`] };
        const multiMatches = findMultiAgencyMatches(item.name, item.cas, item.active || item.api);

        lastAutoResult = {
            smiles: smiles || "N/A (SMILES 직접 미제공)",
            targetName: item.name,
            mdd: hasMdd ? mddVal : null,
            ...cpcaResult,
            ai: item.ai ? `${item.ai} ng/day` : cpcaResult.ai,
            agencyMatch: item,
            agencyKey: agencyKey,
            agencyName: agencyName,
            multiMatches: multiMatches
        };

        if (smiles && smiles !== "N/A (SMILES 직접 미제공)") {
            drawSmilesStructure(smiles, placeholder, canvas, cpcaResult);
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fa-solid fa-circle-info" style="color: var(--color-primary)"></i>
                <p>구조식 시각화 미제공<br><small>${agencyName} 공식 DB 기준 데이터로 연산을 출력합니다.</small></p>
            `;
        }

        renderResults(outputArea, lastAutoResult);
    }

    if (item.smiles) {
        processItemWithSmiles(item.smiles);
    } else {
        fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/chemical/name/${encodeURIComponent(smilesQuery)}/property/CanonicalSMILES/JSON`)
            .then(res => res.json())
            .then(data => {
                const smiles = data.PropertyTable?.Properties?.[0]?.CanonicalSMILES;
                processItemWithSmiles(smiles || null);
            })
            .catch(() => {
                processItemWithSmiles(null);
            });
    }
}


// ==========================================================================
// Feedback & Guestbook System Logic
// ==========================================================================
let currentFbCategory = 'feature';
let currentFbRating = 5;
let currentFbFilterTab = 'ALL';

const DEFAULT_FEEDBACKS = [
    {
        id: 1,
        author: "김민석 연구원",
        org: "OO제약 연구소",
        category: "feature",
        rating: 5,
        content: "FDA CPCA뿐만 아니라 SAR 및 Interim 기준까지 세분화되어 있어 불순물 허용 기준 검토할 때 정말 편리하네요! 2026.08 최신 공고 데이터 반영도 빠르게 이루어져 만족스럽습니다.",
        likes: 12,
        date: "2026-08-30 14:20"
    },
    {
        id: 2,
        author: "박지현 과장",
        org: "글로벌 RA팀",
        category: "data",
        rating: 5,
        content: "식약처 2026.08 최신 고시 수치가 잘 반영되어 있네요. 혹시 EMA(유럽) 고시 기준도 추후 탭으로 추가될 계획이 있는지 궁금합니다.",
        likes: 8,
        date: "2026-08-28 09:45"
    },
    {
        id: 3,
        author: "이동원 님",
        org: "품질보증부",
        category: "general",
        rating: 5,
        content: "SMILES로 2D 구조 자동 시각화 및 CPCA 카테고리 실시간 산출 속도가 매우 빠릅니다. 응원합니다!",
        likes: 15,
        date: "2026-08-25 17:10"
    }
];

function getStoredFeedbacks() {
    try {
        const stored = localStorage.getItem('nitrosamine_feedbacks');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to read feedbacks from localStorage", e);
    }
    localStorage.setItem('nitrosamine_feedbacks', JSON.stringify(DEFAULT_FEEDBACKS));
    return DEFAULT_FEEDBACKS;
}

function saveStoredFeedbacks(feedbacks) {
    try {
        localStorage.setItem('nitrosamine_feedbacks', JSON.stringify(feedbacks));
    } catch (e) {
        console.error("Failed to save feedbacks to localStorage", e);
    }
}

function openFeedbackModal() {
    const modal = document.getElementById('feedbackModalOverlay');
    if (modal) {
        modal.style.display = 'flex';
        renderFeedbackList();
    }
}

function closeFeedbackModal(event) {
    if (!event || event.target.id === 'feedbackModalOverlay' || event.target.closest('.modal-close-btn')) {
        const modal = document.getElementById('feedbackModalOverlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

function selectFeedbackCategory(cat) {
    currentFbCategory = cat;
    document.querySelectorAll('#feedbackCategoryPills .pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
    });
}

function setFeedbackRating(rating) {
    currentFbRating = rating;
    const ratingLabels = {
        1: "1.0 / 5.0 (개선 필요)",
        2: "2.0 / 5.0 (아쉬움)",
        3: "3.0 / 5.0 (보통)",
        4: "4.0 / 5.0 (만족)",
        5: "5.0 / 5.0 (매우 만족)"
    };
    
    document.querySelectorAll('#starRatingPicker .star-btn').forEach(star => {
        const val = parseInt(star.dataset.star);
        star.classList.toggle('active', val <= rating);
    });
    
    const textEl = document.getElementById('starRatingText');
    if (textEl) {
        textEl.textContent = ratingLabels[rating] || `${rating}.0 / 5.0`;
    }
}

function submitFeedback() {
    const contentEl = document.getElementById('fbContent');
    const nameEl = document.getElementById('fbAuthorName');
    const orgEl = document.getElementById('fbAuthorOrg');
    
    const content = contentEl ? contentEl.value.trim() : '';
    if (!content) {
        alert("피드백 내용을 입력해 주세요.");
        return;
    }
    
    const author = nameEl && nameEl.value.trim() ? nameEl.value.trim() : "익명 방문자";
    const org = orgEl && orgEl.value.trim() ? orgEl.value.trim() : "";
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newEntry = {
        id: Date.now(),
        author: author,
        org: org,
        category: currentFbCategory,
        rating: currentFbRating,
        content: content,
        likes: 0,
        date: dateStr
    };
    
    const feedbacks = getStoredFeedbacks();
    feedbacks.unshift(newEntry);
    saveStoredFeedbacks(feedbacks);
    
    // Reset form
    contentEl.value = '';
    if (nameEl) nameEl.value = '';
    if (orgEl) orgEl.value = '';
    setFeedbackRating(5);
    selectFeedbackCategory('feature');
    
    alert("피드백이 성공적으로 등록되었습니다. 감사합니다!");
    renderFeedbackList();
}

function likeFeedback(id) {
    const feedbacks = getStoredFeedbacks();
    const target = feedbacks.find(item => item.id === id);
    if (target) {
        target.likes = (target.likes || 0) + 1;
        saveStoredFeedbacks(feedbacks);
        renderFeedbackList();
    }
}

function filterFeedbackBoard(cat, btnEl) {
    currentFbFilterTab = cat;
    document.querySelectorAll('.board-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderFeedbackList();
}

function renderFeedbackList() {
    const container = document.getElementById('feedbackListContainer');
    const totalCountEl = document.getElementById('feedbackTotalCount');
    const avgRatingEl = document.getElementById('feedbackAvgRating');
    
    if (!container) return;
    
    const feedbacks = getStoredFeedbacks();
    
    // Update stats
    if (totalCountEl) totalCountEl.textContent = `${feedbacks.length}건`;
    if (avgRatingEl && feedbacks.length > 0) {
        const sum = feedbacks.reduce((acc, item) => acc + (item.rating || 5), 0);
        const avg = (sum / feedbacks.length).toFixed(1);
        avgRatingEl.textContent = `⭐ ${avg} / 5.0`;
    }
    
    // Filter
    const filtered = feedbacks.filter(item => currentFbFilterTab === 'ALL' || item.category === currentFbFilterTab);
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-comment-slash" style="font-size: 2.5rem; margin-bottom: 0.8rem; color: #cbd5e1;"></i>
                <p style="margin: 0; font-size: 0.9rem;">등록된 피드백이 없습니다.</p>
            </div>
        `;
        return;
    }
    
    const categoryLabels = {
        feature: { name: "기능 제안", class: "badge-fb-feature" },
        data: { name: "데이터 제보", class: "badge-fb-data" },
        bug: { name: "버그 신고", class: "badge-fb-bug" },
        general: { name: "일반 방명록", class: "badge-fb-general" }
    };
    
    container.innerHTML = filtered.map(item => {
        const catInfo = categoryLabels[item.category] || { name: "방명록", class: "badge-fb-general" };
        const starsHtml = "★".repeat(item.rating || 5) + "☆".repeat(5 - (item.rating || 5));
        const orgText = item.org ? `(${item.org})` : '';

        return `
            <div class="feedback-card">
                <div class="feedback-card-header">
                    <div>
                        <span class="feedback-author">${item.author}</span>
                        <span class="feedback-org">${orgText}</span>
                    </div>
                    <span class="badge ${catInfo.class}">${catInfo.name}</span>
                </div>
                <div class="feedback-body">${item.content}</div>
                <div class="feedback-footer">
                    <span style="color: #f59e0b; font-weight: 700;">${starsHtml}</span>
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <span>${item.date}</span>
                        <button class="like-btn" onclick="likeFeedback(${item.id})">
                            <i class="fa-regular fa-thumbs-up"></i> <span>공감 ${item.likes || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function exportFeedbackJson() {
    const feedbacks = getStoredFeedbacks();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(feedbacks, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `nitrosamines_feedbacks_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}

// Expose feedback functions globally
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.selectFeedbackCategory = selectFeedbackCategory;
window.setFeedbackRating = setFeedbackRating;
window.submitFeedback = submitFeedback;
window.likeFeedback = likeFeedback;
window.filterFeedbackBoard = filterFeedbackBoard;
window.exportFeedbackJson = exportFeedbackJson;
