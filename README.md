# 니트로사민 ADI & 규제 대응 평가 시스템 (nitrosamines-AI)

글로벌 5대 규제기관(식약처, US FDA, EMA, Health Canada, TGA)의 니트로사민류 불순물 1일 섭취허용량(AI) 고시 데이터 및 CPCA(Carcinogenic Potency Categorization Approach) 알고리즘을 기반으로 의약품 불순물 위해성 평가 및 관리기준(ppm) 산출, 심사용 PDF 리포트 생성을 지원하는 클라이언트 사이드 통합 평가 솔루션입니다.

---

## 🌟 주요 기능 (Key Features)

- **글로벌 5대 규제기관 DB 실시간 검색**: MFDS(식약처), US FDA, EMA, Health Canada, TGA 공시 니트로사민 불순물 통합 조회
- **CPCA (Carcinogenic Potency Categorization Approach) 자동 계산**: SMILES 입력을 통한 카테고리(Category 1~5) 및 1일 허용량(AI, ng/day) 실시간 산출
- **1일 최대 복용량(MDD) 연동 불순물 관리기준 산출**: MDD(mg/day) 입력 시 불순물 허용 농도 기준(Limit, ppm) 및 Action Threshold (30% 관리 기준선) 자동 자동 계산
- **자가진단 수동 위자드 (Manual Wizard)**: 구조 파싱이 어려운 화합물에 대해 3단계 체크리스트를 통한 CPCA 직접 판정
- **원클릭 PDF / 인쇄 종합 리포트 엔진**: 규제기관 제출 및 QC 심사용 표준 서식의 위해성 평가 종합 리포트 실시간 생성
- **100% Client-side Security**: 모든 데이터 분석 및 구조 렌더링이 사용자 브라우저 내부에서 수행되어 연구 데이터의 기밀 유지

---

## 📜 라이선스 및 기여도 (License & Credits)

본 프로젝트의 소스 코드는 **[Apache License 2.0](LICENSE)** 규칙을 준수합니다.

### 1. Core Development & Original Features (Developed by Ju-yeon Lee)

| 구분 | 주요 개발 내용 및 기능 설명 |
| :--- | :--- |
| **글로벌 5대 규제기관 DB 파이프라인** | 식약처(MFDS), US FDA, EMA, Health Canada, TGA 등 글로벌 5대 규제기관의 공시 데이터 통합 매핑 및 실시간 검색/자동완성 파이프라인 기획 및 구축 |
| **MDD 연동 ppm 산출 로직** | 1일 최대 복용량(MDD, mg/day)과 섭취허용량(AI, ng/day)을 연동하여 불순물 허용 농도 기준(Limit, ppm) 및 30% 관리고시 기준선 자동 산출 엔지니어링 |
| **PDF 종합 평가 리포트 엔진** | 서명란, CPCA 가감점 세부 내역, 2D 구조식, 5대 기관 대조군 분석 결과가 포함된 표준 심사용 원클릭 PDF 리포트 자동 생성 및 인쇄 엔진 구현 |
| **전체 UI/UX & 워크플로우** | 웹 애플리케이션 프론트엔드 인터페이스 설계, 반응형 대시보드 UI/UX, 사용자 경험(UX) 직관화 및 평가 워크플로우 전체 기획·개발 |

### 2. Third-Party Attribution (서드파티 라이선스 고지)

| 오픈소스 프로젝트 | 라이선스 | 차용 및 연동 내용 |
| :--- | :--- | :--- |
| **[Novartis NDSRIs in silico tool](https://github.com/Novartis/NDSRIs_in_silico_tool)** | Apache License 2.0 | CPCA 계산 알고리즘 일부, 2D 화학 구조식 렌더링 및 SMILES 파싱 모듈에 한해 본 오픈소스 알고리즘을 차용하여 커스텀 웹 솔루션으로 구현함 |

---

## 📌 Citation & Usage Notice (공식 인용 및 참조 가이드)

> **공식 활용 및 출처 표기 안내**  
> 본 시스템의 워크플로우, 데이터 파이프라인 및 고유 기능(5개 규제기관 데이터 매핑, ppm 기준 산출, 리포트 자동 생성 등)을 공무, 연구, 원내 보고 및 출품 등에 인용·활용할 경우 반드시 원저작자(**Ju-yeon Lee**) 및 원천 도구의 출처를 명시해야 합니다.  
> *(Unauthorized derivation without proper citation is strictly prohibited.)*

---

### Copyright Notice
`Copyright 2026 Ju-yeon Lee (이주연). All rights reserved.`  
Licensed under the Apache License, Version 2.0.
