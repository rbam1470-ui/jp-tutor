/* ─────────────────────────────────────────────────────────────
   내장 단어 은행 — JLPT N5~N4 수준의 실생활 회화 단어 240개 (하루 10개 × 24일)
   히라가나/가타카나를 모르는 학습자를 위해 로마자(헵번식) 발음만 제공한다.
   순서대로 10개씩 소비되며, 각 그룹은 주제로 묶여 있어 그날의 회화 연습이
   자연스럽게 이어지도록 했다. 24일치를 다 쓰면 이 배열 끝에 그룹을 추가하면 된다
   (id는 계속 이어서, 기존 id는 절대 바꾸지 말 것 — 학습 기록이 id로 연결되어 있음).
   ───────────────────────────────────────────────────────────── */
'use strict';

const VOCAB_BANK = [
  // Day 1 — 인사 (Greetings)
  { id: 1,   jp: 'こんにちは',           romaji: 'konnichiwa',          ko: '안녕하세요 (낮 인사)',      cat: '인사' },
  { id: 2,   jp: 'おはようございます',   romaji: 'ohayou gozaimasu',    ko: '안녕하세요 (아침 인사)',    cat: '인사' },
  { id: 3,   jp: 'こんばんは',           romaji: 'konbanwa',            ko: '안녕하세요 (저녁 인사)',    cat: '인사' },
  { id: 4,   jp: 'ありがとうございます', romaji: 'arigatou gozaimasu',  ko: '감사합니다',                cat: '인사' },
  { id: 5,   jp: 'すみません',           romaji: 'sumimasen',           ko: '죄송합니다 / 실례합니다',   cat: '인사' },
  { id: 6,   jp: 'さようなら',           romaji: 'sayounara',           ko: '안녕히 가세요 (작별)',      cat: '인사' },
  { id: 7,   jp: 'はい',                 romaji: 'hai',                 ko: '네',                        cat: '인사' },
  { id: 8,   jp: 'いいえ',               romaji: 'iie',                 ko: '아니요',                    cat: '인사' },
  { id: 9,   jp: 'お願いします',         romaji: 'onegaishimasu',       ko: '부탁합니다',                cat: '인사' },
  { id: 10,  jp: '元気',                 romaji: 'genki',               ko: '건강함, 활기참',            cat: '인사' },

  // Day 2 — 자기소개 (Self-introduction)
  { id: 11,  jp: '私',       romaji: 'watashi',   ko: '저, 나',       cat: '자기소개' },
  { id: 12,  jp: 'あなた',   romaji: 'anata',     ko: '당신',         cat: '자기소개' },
  { id: 13,  jp: '名前',     romaji: 'namae',     ko: '이름',         cat: '자기소개' },
  { id: 14,  jp: '学生',     romaji: 'gakusei',   ko: '학생',         cat: '자기소개' },
  { id: 15,  jp: '先生',     romaji: 'sensei',    ko: '선생님',       cat: '자기소개' },
  { id: 16,  jp: '友達',     romaji: 'tomodachi', ko: '친구',         cat: '자기소개' },
  { id: 17,  jp: '家族',     romaji: 'kazoku',    ko: '가족',         cat: '자기소개' },
  { id: 18,  jp: '韓国',     romaji: 'kankoku',   ko: '한국',         cat: '자기소개' },
  { id: 19,  jp: '日本',     romaji: 'nihon',     ko: '일본',         cat: '자기소개' },
  { id: 20,  jp: '人',       romaji: 'hito',      ko: '사람',         cat: '자기소개' },

  // Day 3 — 숫자 1~10 (Numbers)
  { id: 21,  jp: '一',   romaji: 'ichi',  ko: '1 (하나)', cat: '숫자' },
  { id: 22,  jp: '二',   romaji: 'ni',    ko: '2 (둘)',   cat: '숫자' },
  { id: 23,  jp: '三',   romaji: 'san',   ko: '3 (셋)',   cat: '숫자' },
  { id: 24,  jp: '四',   romaji: 'yon',   ko: '4 (넷)',   cat: '숫자' },
  { id: 25,  jp: '五',   romaji: 'go',    ko: '5 (다섯)', cat: '숫자' },
  { id: 26,  jp: '六',   romaji: 'roku',  ko: '6 (여섯)', cat: '숫자' },
  { id: 27,  jp: '七',   romaji: 'nana',  ko: '7 (일곱)', cat: '숫자' },
  { id: 28,  jp: '八',   romaji: 'hachi', ko: '8 (여덟)', cat: '숫자' },
  { id: 29,  jp: '九',   romaji: 'kyuu',  ko: '9 (아홉)', cat: '숫자' },
  { id: 30,  jp: '十',   romaji: 'juu',   ko: '10 (열)',  cat: '숫자' },

  // Day 4 — 시간 (Time)
  { id: 31,  jp: '今日',     romaji: 'kyou',       ko: '오늘',   cat: '시간' },
  { id: 32,  jp: '明日',     romaji: 'ashita',     ko: '내일',   cat: '시간' },
  { id: 33,  jp: '昨日',     romaji: 'kinou',      ko: '어제',   cat: '시간' },
  { id: 34,  jp: '今',       romaji: 'ima',        ko: '지금',   cat: '시간' },
  { id: 35,  jp: '時間',     romaji: 'jikan',      ko: '시간',   cat: '시간' },
  { id: 36,  jp: '朝',       romaji: 'asa',        ko: '아침',   cat: '시간' },
  { id: 37,  jp: '昼',       romaji: 'hiru',       ko: '낮',     cat: '시간' },
  { id: 38,  jp: '夜',       romaji: 'yoru',       ko: '밤',     cat: '시간' },
  { id: 39,  jp: '週末',     romaji: 'shuumatsu',  ko: '주말',   cat: '시간' },
  { id: 40,  jp: '毎日',     romaji: 'mainichi',   ko: '매일',   cat: '시간' },

  // Day 5 — 음식과 음료 (Food & Drink)
  { id: 41,  jp: '食べ物',   romaji: 'tabemono', ko: '음식',   cat: '음식' },
  { id: 42,  jp: '飲み物',   romaji: 'nomimono', ko: '음료',   cat: '음식' },
  { id: 43,  jp: '水',       romaji: 'mizu',     ko: '물',     cat: '음식' },
  { id: 44,  jp: 'ご飯',     romaji: 'gohan',    ko: '밥',     cat: '음식' },
  { id: 45,  jp: 'パン',     romaji: 'pan',      ko: '빵',     cat: '음식' },
  { id: 46,  jp: '肉',       romaji: 'niku',     ko: '고기',   cat: '음식' },
  { id: 47,  jp: '魚',       romaji: 'sakana',   ko: '생선',   cat: '음식' },
  { id: 48,  jp: '野菜',     romaji: 'yasai',    ko: '채소',   cat: '음식' },
  { id: 49,  jp: '果物',     romaji: 'kudamono', ko: '과일',   cat: '음식' },
  { id: 50,  jp: 'コーヒー', romaji: 'koohii',   ko: '커피',   cat: '음식' },

  // Day 6 — 기본 동사 1 (Basic verbs 1)
  { id: 51,  jp: '食べる', romaji: 'taberu', ko: '먹다',           cat: '동사' },
  { id: 52,  jp: '飲む',   romaji: 'nomu',   ko: '마시다',         cat: '동사' },
  { id: 53,  jp: '行く',   romaji: 'iku',    ko: '가다',           cat: '동사' },
  { id: 54,  jp: '来る',   romaji: 'kuru',   ko: '오다',           cat: '동사' },
  { id: 55,  jp: '見る',   romaji: 'miru',   ko: '보다',           cat: '동사' },
  { id: 56,  jp: '聞く',   romaji: 'kiku',   ko: '듣다 / 묻다',    cat: '동사' },
  { id: 57,  jp: '話す',   romaji: 'hanasu', ko: '이야기하다',     cat: '동사' },
  { id: 58,  jp: '読む',   romaji: 'yomu',   ko: '읽다',           cat: '동사' },
  { id: 59,  jp: '書く',   romaji: 'kaku',   ko: '쓰다',           cat: '동사' },
  { id: 60,  jp: '買う',   romaji: 'kau',    ko: '사다',           cat: '동사' },

  // Day 7 — 기본 동사 2 (Basic verbs 2)
  { id: 61,  jp: 'する',       romaji: 'suru',          ko: '하다',           cat: '동사' },
  { id: 62,  jp: 'ある',       romaji: 'aru',           ko: '있다 (사물)',    cat: '동사' },
  { id: 63,  jp: 'いる',       romaji: 'iru',           ko: '있다 (사람·동물)', cat: '동사' },
  { id: 64,  jp: '分かる',     romaji: 'wakaru',        ko: '이해하다, 알다', cat: '동사' },
  { id: 65,  jp: '好きだ',     romaji: 'suki da',       ko: '좋아하다',       cat: '동사' },
  { id: 66,  jp: '勉強する',   romaji: 'benkyou suru',  ko: '공부하다',       cat: '동사' },
  { id: 67,  jp: '働く',       romaji: 'hataraku',      ko: '일하다',         cat: '동사' },
  { id: 68,  jp: '休む',       romaji: 'yasumu',        ko: '쉬다',           cat: '동사' },
  { id: 69,  jp: '寝る',       romaji: 'neru',          ko: '자다',           cat: '동사' },
  { id: 70,  jp: '起きる',     romaji: 'okiru',         ko: '일어나다',       cat: '동사' },

  // Day 8 — 형용사 (Adjectives)
  { id: 71,  jp: 'いい',       romaji: 'ii',       ko: '좋은',     cat: '형용사' },
  { id: 72,  jp: '悪い',       romaji: 'warui',    ko: '나쁜',     cat: '형용사' },
  { id: 73,  jp: '大きい',     romaji: 'ookii',    ko: '큰',       cat: '형용사' },
  { id: 74,  jp: '小さい',     romaji: 'chiisai',  ko: '작은',     cat: '형용사' },
  { id: 75,  jp: '新しい',     romaji: 'atarashii',ko: '새로운',   cat: '형용사' },
  { id: 76,  jp: '古い',       romaji: 'furui',    ko: '오래된',   cat: '형용사' },
  { id: 77,  jp: '暑い',       romaji: 'atsui',    ko: '더운',     cat: '형용사' },
  { id: 78,  jp: '寒い',       romaji: 'samui',    ko: '추운',     cat: '형용사' },
  { id: 79,  jp: 'おいしい',   romaji: 'oishii',   ko: '맛있는',   cat: '형용사' },
  { id: 80,  jp: '楽しい',     romaji: 'tanoshii', ko: '즐거운',   cat: '형용사' },

  // Day 9 — 의문사와 지시어 (Question words & demonstratives)
  { id: 81,  jp: '何',       romaji: 'nani',      ko: '무엇',   cat: '의문사' },
  { id: 82,  jp: 'どこ',     romaji: 'doko',      ko: '어디',   cat: '의문사' },
  { id: 83,  jp: 'いつ',     romaji: 'itsu',      ko: '언제',   cat: '의문사' },
  { id: 84,  jp: 'だれ',     romaji: 'dare',      ko: '누구',   cat: '의문사' },
  { id: 85,  jp: 'どうして', romaji: 'doushite',  ko: '왜',     cat: '의문사' },
  { id: 86,  jp: 'どう',     romaji: 'dou',       ko: '어떻게', cat: '의문사' },
  { id: 87,  jp: 'これ',     romaji: 'kore',      ko: '이것',   cat: '의문사' },
  { id: 88,  jp: 'それ',     romaji: 'sore',      ko: '그것',   cat: '의문사' },
  { id: 89,  jp: 'あれ',     romaji: 'are',       ko: '저것',   cat: '의문사' },
  { id: 90,  jp: 'ここ',     romaji: 'koko',      ko: '여기',   cat: '의문사' },

  // Day 10 — 장소 (Places)
  { id: 91,  jp: '学校',     romaji: 'gakkou',  ko: '학교',   cat: '장소' },
  { id: 92,  jp: '会社',     romaji: 'kaisha',  ko: '회사',   cat: '장소' },
  { id: 93,  jp: '家',       romaji: 'ie',      ko: '집',     cat: '장소' },
  { id: 94,  jp: '駅',       romaji: 'eki',     ko: '역',     cat: '장소' },
  { id: 95,  jp: '店',       romaji: 'mise',    ko: '가게',   cat: '장소' },
  { id: 96,  jp: '病院',     romaji: 'byouin',  ko: '병원',   cat: '장소' },
  { id: 97,  jp: '銀行',     romaji: 'ginkou',  ko: '은행',   cat: '장소' },
  { id: 98,  jp: '公園',     romaji: 'kouen',   ko: '공원',   cat: '장소' },
  { id: 99,  jp: '日本語',   romaji: 'nihongo', ko: '일본어', cat: '장소' },
  { id: 100, jp: '英語',     romaji: 'eigo',    ko: '영어',   cat: '장소' },

  // Day 11 — 가족과 동물 (Family & animals)
  { id: 101, jp: 'お父さん', romaji: 'otousan', ko: '아버지',       cat: '가족' },
  { id: 102, jp: 'お母さん', romaji: 'okaasan', ko: '어머니',       cat: '가족' },
  { id: 103, jp: '兄',       romaji: 'ani',     ko: '형 / 오빠',    cat: '가족' },
  { id: 104, jp: '姉',       romaji: 'ane',     ko: '누나 / 언니',  cat: '가족' },
  { id: 105, jp: '弟',       romaji: 'otouto',  ko: '남동생',       cat: '가족' },
  { id: 106, jp: '妹',       romaji: 'imouto',  ko: '여동생',       cat: '가족' },
  { id: 107, jp: '子供',     romaji: 'kodomo',  ko: '아이',         cat: '가족' },
  { id: 108, jp: '夫',       romaji: 'otto',    ko: '남편',         cat: '가족' },
  { id: 109, jp: '妻',       romaji: 'tsuma',   ko: '아내',         cat: '가족' },
  { id: 110, jp: '犬',       romaji: 'inu',     ko: '개',           cat: '가족' },

  // Day 12 — 날씨와 취미 (Weather & hobbies)
  { id: 111, jp: '天気',     romaji: 'tenki',    ko: '날씨',   cat: '취미' },
  { id: 112, jp: '雨',       romaji: 'ame',      ko: '비',     cat: '취미' },
  { id: 113, jp: '雪',       romaji: 'yuki',     ko: '눈 (날씨)', cat: '취미' },
  { id: 114, jp: '晴れ',     romaji: 'hare',     ko: '맑음',   cat: '취미' },
  { id: 115, jp: '趣味',     romaji: 'shumi',    ko: '취미',   cat: '취미' },
  { id: 116, jp: '音楽',     romaji: 'ongaku',   ko: '음악',   cat: '취미' },
  { id: 117, jp: '映画',     romaji: 'eiga',     ko: '영화',   cat: '취미' },
  { id: 118, jp: '旅行',     romaji: 'ryokou',   ko: '여행',   cat: '취미' },
  { id: 119, jp: 'スポーツ', romaji: 'supootsu', ko: '스포츠', cat: '취미' },
  { id: 120, jp: '猫',       romaji: 'neko',     ko: '고양이', cat: '취미' },

  // Day 13 — 요일 (Days of the week)
  { id: 121, jp: '月曜日',   romaji: 'getsuyoubi', ko: '월요일',     cat: '요일' },
  { id: 122, jp: '火曜日',   romaji: 'kayoubi',    ko: '화요일',     cat: '요일' },
  { id: 123, jp: '水曜日',   romaji: 'suiyoubi',   ko: '수요일',     cat: '요일' },
  { id: 124, jp: '木曜日',   romaji: 'mokuyoubi',  ko: '목요일',     cat: '요일' },
  { id: 125, jp: '金曜日',   romaji: 'kinyoubi',   ko: '금요일',     cat: '요일' },
  { id: 126, jp: '土曜日',   romaji: 'doyoubi',    ko: '토요일',     cat: '요일' },
  { id: 127, jp: '日曜日',   romaji: 'nichiyoubi', ko: '일요일',     cat: '요일' },
  { id: 128, jp: '何曜日',   romaji: 'nan\'youbi', ko: '무슨 요일',  cat: '요일' },
  { id: 129, jp: '先週',     romaji: 'senshuu',    ko: '지난주',     cat: '요일' },
  { id: 130, jp: '来週',     romaji: 'raishuu',    ko: '다음 주',    cat: '요일' },

  // Day 14 — 색깔 (Colors)
  { id: 131, jp: '色',       romaji: 'iro',     ko: '색',     cat: '색깔' },
  { id: 132, jp: '赤',       romaji: 'aka',     ko: '빨강',   cat: '색깔' },
  { id: 133, jp: '青',       romaji: 'ao',      ko: '파랑',   cat: '색깔' },
  { id: 134, jp: '白',       romaji: 'shiro',   ko: '흰색',   cat: '색깔' },
  { id: 135, jp: '黒',       romaji: 'kuro',    ko: '검정',   cat: '색깔' },
  { id: 136, jp: '黄色',     romaji: 'kiiro',   ko: '노랑',   cat: '색깔' },
  { id: 137, jp: '緑',       romaji: 'midori',  ko: '초록',   cat: '색깔' },
  { id: 138, jp: '茶色',     romaji: 'chairo',  ko: '갈색',   cat: '색깔' },
  { id: 139, jp: 'ピンク',   romaji: 'pinku',   ko: '분홍',   cat: '색깔' },
  { id: 140, jp: '紫',       romaji: 'murasaki',ko: '보라',   cat: '색깔' },

  // Day 15 — 신체 (Body)
  { id: 141, jp: '頭',       romaji: 'atama',   ko: '머리',       cat: '신체' },
  { id: 142, jp: '顔',       romaji: 'kao',     ko: '얼굴',       cat: '신체' },
  { id: 143, jp: '目',       romaji: 'me',      ko: '눈 (신체)',  cat: '신체' },
  { id: 144, jp: '耳',       romaji: 'mimi',    ko: '귀',         cat: '신체' },
  { id: 145, jp: '口',       romaji: 'kuchi',   ko: '입',         cat: '신체' },
  { id: 146, jp: '手',       romaji: 'te',      ko: '손',         cat: '신체' },
  { id: 147, jp: '足',       romaji: 'ashi',    ko: '다리 / 발',  cat: '신체' },
  { id: 148, jp: 'お腹',     romaji: 'onaka',   ko: '배 (복부)',  cat: '신체' },
  { id: 149, jp: '背中',     romaji: 'senaka',  ko: '등',         cat: '신체' },
  { id: 150, jp: '体',       romaji: 'karada',  ko: '몸',         cat: '신체' },

  // Day 16 — 옷과 쇼핑 (Clothing & shopping)
  { id: 151, jp: '服',       romaji: 'fuku',     ko: '옷',       cat: '쇼핑' },
  { id: 152, jp: '靴',       romaji: 'kutsu',    ko: '신발',     cat: '쇼핑' },
  { id: 153, jp: '帽子',     romaji: 'boushi',   ko: '모자',     cat: '쇼핑' },
  { id: 154, jp: 'かばん',   romaji: 'kaban',    ko: '가방',     cat: '쇼핑' },
  { id: 155, jp: '時計',     romaji: 'tokei',    ko: '시계',     cat: '쇼핑' },
  { id: 156, jp: '値段',     romaji: 'nedan',    ko: '가격',     cat: '쇼핑' },
  { id: 157, jp: 'お金',     romaji: 'okane',    ko: '돈',       cat: '쇼핑' },
  { id: 158, jp: '安い',     romaji: 'yasui',    ko: '싼',       cat: '쇼핑' },
  { id: 159, jp: '高い',     romaji: 'takai',    ko: '비싼 / 높은', cat: '쇼핑' },
  { id: 160, jp: '買い物',   romaji: 'kaimono',  ko: '쇼핑',     cat: '쇼핑' },

  // Day 17 — 교통 (Transportation)
  { id: 161, jp: '電車',       romaji: 'densha',     ko: '전철',     cat: '교통' },
  { id: 162, jp: 'バス',       romaji: 'basu',       ko: '버스',     cat: '교통' },
  { id: 163, jp: '車',         romaji: 'kuruma',     ko: '자동차',   cat: '교통' },
  { id: 164, jp: '自転車',     romaji: 'jitensha',   ko: '자전거',   cat: '교통' },
  { id: 165, jp: '飛行機',     romaji: 'hikouki',    ko: '비행기',   cat: '교통' },
  { id: 166, jp: 'タクシー',   romaji: 'takushii',   ko: '택시',     cat: '교통' },
  { id: 167, jp: '道',         romaji: 'michi',      ko: '길',       cat: '교통' },
  { id: 168, jp: '右',         romaji: 'migi',       ko: '오른쪽',   cat: '교통' },
  { id: 169, jp: '左',         romaji: 'hidari',     ko: '왼쪽',     cat: '교통' },
  { id: 170, jp: '真っ直ぐ',   romaji: 'massugu',    ko: '곧장',     cat: '교통' },

  // Day 18 — 감정 (Emotions)
  { id: 171, jp: '嬉しい',     romaji: 'ureshii',      ko: '기쁜',       cat: '감정' },
  { id: 172, jp: '悲しい',     romaji: 'kanashii',     ko: '슬픈',       cat: '감정' },
  { id: 173, jp: '怖い',       romaji: 'kowai',        ko: '무서운',     cat: '감정' },
  { id: 174, jp: '忙しい',     romaji: 'isogashii',    ko: '바쁜',       cat: '감정' },
  { id: 175, jp: '眠い',       romaji: 'nemui',        ko: '졸린',       cat: '감정' },
  { id: 176, jp: '疲れる',     romaji: 'tsukareru',    ko: '피곤하다',   cat: '감정' },
  { id: 177, jp: '心配する',   romaji: 'shinpai suru', ko: '걱정하다',   cat: '감정' },
  { id: 178, jp: 'びっくりする', romaji: 'bikkuri suru', ko: '놀라다',   cat: '감정' },
  { id: 179, jp: '大丈夫',     romaji: 'daijoubu',     ko: '괜찮음',     cat: '감정' },
  { id: 180, jp: '気持ち',     romaji: 'kimochi',      ko: '기분 / 감정', cat: '감정' },

  // Day 19 — 직장 (Work)
  { id: 181, jp: '仕事',   romaji: 'shigoto',   ko: '일, 업무',   cat: '직장' },
  { id: 182, jp: '会議',   romaji: 'kaigi',     ko: '회의',       cat: '직장' },
  { id: 183, jp: '授業',   romaji: 'jugyou',    ko: '수업',       cat: '직장' },
  { id: 184, jp: '宿題',   romaji: 'shukudai',  ko: '숙제',       cat: '직장' },
  { id: 185, jp: '試験',   romaji: 'shiken',    ko: '시험',       cat: '직장' },
  { id: 186, jp: '休み',   romaji: 'yasumi',    ko: '휴일, 방학', cat: '직장' },
  { id: 187, jp: '給料',   romaji: 'kyuuryou',  ko: '월급',       cat: '직장' },
  { id: 188, jp: '同僚',   romaji: 'douryou',   ko: '동료',       cat: '직장' },
  { id: 189, jp: '部長',   romaji: 'buchou',    ko: '부장',       cat: '직장' },
  { id: 190, jp: '社長',   romaji: 'shachou',   ko: '사장',       cat: '직장' },

  // Day 20 — 건강 (Health)
  { id: 191, jp: '病気',     romaji: 'byouki',   ko: '병',         cat: '건강' },
  { id: 192, jp: '薬',       romaji: 'kusuri',   ko: '약',         cat: '건강' },
  { id: 193, jp: '痛い',     romaji: 'itai',     ko: '아픈',       cat: '건강' },
  { id: 194, jp: '熱',       romaji: 'netsu',    ko: '열 (체온)',  cat: '건강' },
  { id: 195, jp: '風邪',     romaji: 'kaze',     ko: '감기',       cat: '건강' },
  { id: 196, jp: '医者',     romaji: 'isha',     ko: '의사',       cat: '건강' },
  { id: 197, jp: '看護師',   romaji: 'kangoshi', ko: '간호사',     cat: '건강' },
  { id: 198, jp: '健康',     romaji: 'kenkou',   ko: '건강 (명사)', cat: '건강' },
  { id: 199, jp: 'ダイエット', romaji: 'daietto', ko: '다이어트',   cat: '건강' },
  { id: 200, jp: '運動',     romaji: 'undou',    ko: '운동',       cat: '건강' },

  // Day 21 — 계절과 자연 (Seasons & nature)
  { id: 201, jp: '春',   romaji: 'haru',   ko: '봄',   cat: '계절' },
  { id: 202, jp: '夏',   romaji: 'natsu',  ko: '여름', cat: '계절' },
  { id: 203, jp: '秋',   romaji: 'aki',    ko: '가을', cat: '계절' },
  { id: 204, jp: '冬',   romaji: 'fuyu',   ko: '겨울', cat: '계절' },
  { id: 205, jp: '花',   romaji: 'hana',   ko: '꽃',   cat: '계절' },
  { id: 206, jp: '木',   romaji: 'ki',     ko: '나무', cat: '계절' },
  { id: 207, jp: '空',   romaji: 'sora',   ko: '하늘', cat: '계절' },
  { id: 208, jp: '海',   romaji: 'umi',    ko: '바다', cat: '계절' },
  { id: 209, jp: '山',   romaji: 'yama',   ko: '산',   cat: '계절' },
  { id: 210, jp: '川',   romaji: 'kawa',   ko: '강',   cat: '계절' },

  // Day 22 — 요리와 맛 (Cooking & taste)
  { id: 211, jp: '料理',     romaji: 'ryouri',   ko: '요리',   cat: '요리' },
  { id: 212, jp: '作る',     romaji: 'tsukuru',  ko: '만들다', cat: '요리' },
  { id: 213, jp: '甘い',     romaji: 'amai',     ko: '단',     cat: '요리' },
  { id: 214, jp: '辛い',     romaji: 'karai',    ko: '매운',   cat: '요리' },
  { id: 215, jp: '酸っぱい', romaji: 'suppai',   ko: '신',     cat: '요리' },
  { id: 216, jp: '苦い',     romaji: 'nigai',    ko: '쓴',     cat: '요리' },
  { id: 217, jp: '塩',       romaji: 'shio',     ko: '소금',   cat: '요리' },
  { id: 218, jp: '砂糖',     romaji: 'satou',    ko: '설탕',   cat: '요리' },
  { id: 219, jp: '卵',       romaji: 'tamago',   ko: '계란',   cat: '요리' },
  { id: 220, jp: '牛乳',     romaji: 'gyuunyuu', ko: '우유',   cat: '요리' },

  // Day 23 — 전자기기 (Technology)
  { id: 221, jp: '携帯電話',   romaji: 'keitai denwa', ko: '휴대전화', cat: '전자기기' },
  { id: 222, jp: 'パソコン',   romaji: 'pasokon',      ko: '컴퓨터',   cat: '전자기기' },
  { id: 223, jp: '写真',       romaji: 'shashin',      ko: '사진',     cat: '전자기기' },
  { id: 224, jp: '電話する',   romaji: 'denwa suru',   ko: '전화하다', cat: '전자기기' },
  { id: 225, jp: '送る',       romaji: 'okuru',        ko: '보내다',   cat: '전자기기' },
  { id: 226, jp: '使う',       romaji: 'tsukau',       ko: '사용하다', cat: '전자기기' },
  { id: 227, jp: 'アプリ',     romaji: 'apuri',        ko: '앱',       cat: '전자기기' },
  { id: 228, jp: '充電',       romaji: 'juuden',       ko: '충전',     cat: '전자기기' },
  { id: 229, jp: 'インターネット', romaji: 'intaanetto', ko: '인터넷', cat: '전자기기' },
  { id: 230, jp: '動画',       romaji: 'douga',        ko: '동영상',   cat: '전자기기' },

  // Day 24 — 정도·빈도 부사 (Degree & frequency adverbs)
  { id: 231, jp: 'とても',   romaji: 'totemo',   ko: '매우',       cat: '부사' },
  { id: 232, jp: '少し',     romaji: 'sukoshi',  ko: '조금',       cat: '부사' },
  { id: 233, jp: 'たくさん', romaji: 'takusan',  ko: '많이',       cat: '부사' },
  { id: 234, jp: 'いつも',   romaji: 'itsumo',   ko: '항상',       cat: '부사' },
  { id: 235, jp: 'よく',     romaji: 'yoku',     ko: '자주',       cat: '부사' },
  { id: 236, jp: '時々',     romaji: 'tokidoki', ko: '가끔',       cat: '부사' },
  { id: 237, jp: 'ぜんぜん', romaji: 'zenzen',   ko: '전혀',       cat: '부사' },
  { id: 238, jp: 'もう',     romaji: 'mou',      ko: '이미, 벌써', cat: '부사' },
  { id: 239, jp: 'まだ',     romaji: 'mada',     ko: '아직',       cat: '부사' },
  { id: 240, jp: '一緒に',   romaji: 'issho ni', ko: '함께',       cat: '부사' },
];

const VOCAB_BY_ID = new Map(VOCAB_BANK.map((w) => [w.id, w]));
