import type { ContentLanguage } from '../i18n/locales';
import { prepareQuickStory, QUICK_IDS, QUICK_STAGES, QUICK_TARGETS } from '../services/quickStory';

const demos = {
  ko: {
    title: '내일의 목소리', description: '미래에서 온 경고 앞에서, 혼자 안전을 지킬지 친구와 위험을 나눌지 선택한다.',
    name: '유나', character: '오래된 라디오를 고치는 신중한 대학생. 친구를 잃는 것이 두렵다.',
    scenes: ['경고', '증거', '결정', '함께 지킨 내일', '홀로 지킨 내일'],
    next: '계속', choices: ['친구에게 경고를 알리고 함께 대피시킨다', '친구 몰래 전원을 차단한다'],
    lines: [
      ['할머니의 라디오에서 내 목소리가 들렸다. 내일 저녁, 강변 축제의 조명이 무너진다는 경고였다.', '장난이라고 생각했지만, 목소리는 아직 누구에게도 말하지 않은 내 비밀을 알고 있었다.', '나는 수리하던 손을 멈추었다. 내일 그 축제에서는 가장 친한 친구가 첫 공연을 할 예정이었다.', '라디오의 잡음 사이로 한마디가 더 흘렀다. 이번에는 혼자 결정하지 말라는 말이었다.'],
      ['다음 날 오후, 무대 뒤에서 젖은 전선과 금이 간 지지대를 발견했다. 경고는 사실이었다.', '담당자는 바쁘다며 내 말을 듣지 않았다. 공연까지 남은 시간은 십 분뿐이었다.', '친구는 무대 위에서 손을 흔들었다. 이 공연을 위해 일 년을 준비했다는 것을 나는 알고 있었다.', '지금 모두에게 알리면 공연은 취소된다. 몰래 전원을 끄면 누구도 다치지 않겠지만 이유를 설명할 수 없을지도 모른다.'],
      ['라디오가 다시 울렸다. 이번에는 미래의 내가 울고 있었다. 다친 사람이 누구인지는 들리지 않았다.', '나는 차단기 앞에서 휴대전화를 꺼냈다. 친구에게 전화를 걸 수도, 지금 전원을 끌 수도 있었다.', '완벽한 선택은 없었다. 하지만 친구를 지키는 일과 친구를 믿는 일은 다를 수 있었다.', '나는 깊게 숨을 들이마셨다. 내일의 목소리가 아니라, 오늘의 내 목소리로 결정할 차례였다.'],
      ['나는 친구에게 전화를 걸어 무대의 위험을 알렸다. 친구는 떨리는 목소리로 관객에게 대피를 부탁했다.', '사람들이 물러난 직후 조명이 쓰러졌다. 비어 있는 무대를 보며 우리는 서로의 손을 붙잡았다.', '공연은 취소되었지만 친구는 나를 탓하지 않았다. 다음 무대도 함께 준비하자고 말했다.', '집에 돌아오자 라디오는 조용했다. 나는 미래를 아는 대신, 두려움을 함께 말할 사람을 얻었다.'],
      ['나는 차단기를 내렸다. 무대가 어두워지자 관객은 돌아갔고, 잠시 뒤 쓰러진 조명에도 다친 사람은 없었다.', '친구는 누가 공연을 망쳤는지 물었다. 나는 차단기 옆에 서서 아무 말도 하지 못했다.', '우리는 무사했지만 친구의 마지막 인사는 차가웠다. 안전을 지키면서도 신뢰를 잃을 수 있다는 것을 알았다.', '집에서 라디오를 켰다. 이번에는 내 목소리로 친구에게 사과를 녹음했다. 내일은 진실을 말하기로 했다.'],
    ],
  },
  ja: {
    title: '明日の声', description: '未来からの警告を受け、一人で友人を守るか、危険を伝えて共に行動するかを選ぶ。',
    name: 'ユナ', character: '古いラジオを直す慎重な大学生。友人を失うことを恐れている。',
    scenes: ['警告', '証拠', '決断', '共に守った明日', '一人で守った明日'], next: '続ける',
    choices: ['友人に警告を伝え、一緒に避難を呼びかける', '友人に黙って電源を切る'],
    lines: [
      ['祖母のラジオから自分の声が聞こえた。明日の夕方、川辺の祭りで照明が落ちるという警告だった。', 'いたずらだと思ったが、その声は誰にも話していない秘密を知っていた。', '私は修理の手を止めた。明日の祭りでは、親友が初めての舞台に立つ予定だった。', '雑音の向こうから、もう一言聞こえた。今度は一人で決めないで、という声だった。'],
      ['翌日の午後、舞台裏で濡れた電線とひびの入った支柱を見つけた。警告は本当だった。', '係の人は忙しいと取り合わなかった。開演まで、あと十分しかなかった。', '友人が舞台の上から手を振った。この公演のために一年間準備してきたことを、私は知っていた。', '皆に知らせれば公演は中止になる。黙って電源を切れば事故は防げても、理由を説明できないかもしれない。'],
      ['ラジオが再び鳴った。未来の私は泣いていたが、誰が傷ついたのかは聞き取れなかった。', '私は配電盤の前で携帯を取り出した。友人に電話することも、今すぐ電源を切ることもできた。', '完璧な選択はない。けれど、友人を守ることと、友人を信じることは違うのかもしれない。', '深く息を吸った。未来の声ではなく、今日の自分の声で決める番だった。'],
      ['私は友人に電話をかけ、舞台の危険を伝えた。友人は震える声で観客に避難を呼びかけた。', '皆が離れた直後、照明が落ちた。誰もいない舞台を見つめながら、私たちは手を握り合った。', '公演は中止になったが、友人は私を責めなかった。次の舞台も一緒に準備しようと言った。', '家に戻るとラジオは静かだった。未来を知る代わりに、怖さを分かち合える相手ができた。'],
      ['私は電源を切った。舞台が暗くなると観客は帰り、その後に落ちた照明でけがをした人はいなかった。', '友人は誰が公演を台無しにしたのかと尋ねた。私は配電盤のそばで、何も言えなかった。', '私たちは無事だったが、友人の別れの挨拶は冷たかった。安全を守っても、信頼を失うことはあるのだ。', '家でラジオをつけ、自分の声で友人への謝罪を録音した。明日は本当のことを話そうと決めた。'],
    ],
  },
  en: {
    title: 'Tomorrow’s Voice', description: 'A warning from the future forces a choice: protect a friend alone, or trust them with the danger.',
    name: 'Yuna', character: 'A cautious student who repairs old radios and fears losing her closest friend.',
    scenes: ['The warning', 'The evidence', 'The decision', 'Tomorrow, together', 'Tomorrow, alone'], next: 'Continue',
    choices: ['Warn my friend and help everyone evacuate', 'Cut the power without telling my friend'],
    lines: [
      ['My grandmother’s radio spoke in my own voice. Tomorrow evening, it warned, the lights above the riverside festival stage would fall.', 'I thought it was a prank until the voice mentioned a secret I had never told anyone. My hands froze over the broken dial.', 'My closest friend was performing there tomorrow. She had spent a year preparing for her first real audience, and I had promised to be there.', 'Through the static came one final sentence: This time, do not decide alone. Then the radio fell silent, leaving me with a tomorrow I suddenly feared.'],
      ['The next afternoon I found wet cables and a cracked support behind the stage. The warning was real, and the audience was already arriving.', 'The organizer waved me away, too busy to listen. There were ten minutes before the performance and no time to find someone else.', 'My friend waved from the stage. I remembered all the nights she had practiced, and how much courage it had taken to invite her family.', 'If I raised the alarm, her performance would be canceled. If I secretly cut the power, everyone might be safe, but she might never understand why.'],
      ['The radio crackled again. My future voice was crying, but the static swallowed the name. I could not tell who had been hurt.', 'At the breaker box I took out my phone. One call could bring my friend into the decision. One switch could end the performance immediately.', 'Neither choice was perfect. Protecting someone and trusting them were not always the same thing, and fear made it hard to tell them apart.', 'I took a breath. The future had given me a warning, not an answer. Now I had to choose what my own voice would say.'],
      ['I called my friend and explained the danger above the stage. Her voice shook as she asked the audience to move away from the stage.', 'The lights crashed moments after the last person stepped back. We held hands and stared at the empty place where she would have been standing.', 'The performance was canceled, but she did not blame me. Next time, she said, we would prepare the stage together as well as the music.', 'At home the radio stayed silent. I had lost my certainty about tomorrow, but gained someone with whom I could share the fear of it.'],
      ['I cut the power. The audience drifted away from the dark stage, and when the lights finally fell, nobody was beneath them. Everyone was safe.', 'My friend asked who had ruined the performance. I stood beside the breaker box and said nothing, unable to explain a warning from tomorrow.', 'Her goodbye was cold. I had protected her body while taking away her chance to decide, and safety did not erase the distance between us.', 'At home I recorded an apology on the radio. Tomorrow I would tell her the truth. Saving our friendship would require a different kind of courage.'],
    ],
  },
};

const investigations = {
  ko: {
    names: ['첫 번째 선택', '전선의 흔적', '피할 수 있는 길', '함께 움직일 준비'],
    choices: ['무대 뒤 전선을 직접 확인한다', '관객이 빠져나갈 길을 먼저 찾는다'],
    lines: [
      ['다음 날 나는 공연장에 일찍 도착했다. 조명 아래로 물이 떨어지고 있었지만 사람들은 준비에 몰두하고 있었다.', '무대를 지켜보는 것만으로 경고를 막을 수는 없었다. 무엇이 위험한지, 어디로 피할지 알아야 했다.', '전선은 무대 뒤로 이어졌고, 반대편에는 좁은 출구가 있었다. 둘 다 살피기에는 시간이 부족했다.', '먼저 확인한 사실이 친구에게 위험을 설명할 단서가 될 것이다. 나는 발걸음을 멈추고 방향을 골랐다.'],
      ['무대 뒤에서 젖은 전선과 금이 간 지지대를 발견했다. 나는 손대지 않고 사진을 찍었다.', '장비 담당자는 잠시 자리를 비운 상태였다. 관객은 계속 들어왔고 공연까지 십 분밖에 남지 않았다.', '증거를 확보했지만 혼자 수리할 수 있는 고장은 아니었다. 직접 건드리는 일은 더 위험했다.', '나는 안전한 곳으로 물러났다. 이제 위험을 알리거나 전원을 차단할 방법을 결정해야 했다.'],
      ['나는 출구를 따라 걸었다. 정문은 붐볐지만 옆문은 비어 있었고 강변 산책로로 이어졌다.', '입구 안내판을 옆으로 옮겨 통로를 확보했다. 그 짧은 사이에도 관객은 계속 늘어났다.', '무대 쪽에서 금속이 비틀리는 소리가 났다. 탈출할 길을 알게 되었지만 위험 자체가 사라진 것은 아니었다.', '나는 친구가 있는 쪽으로 돌아갔다. 이제 위험을 알리거나 전원을 차단할 방법을 결정해야 했다.'],
      ['친구에게 전화를 건다면 무대에서 물러나 달라고 분명히 말해야 한다. 나는 대피 요청을 짧게 정리했다.', '안내 방송을 멈추고 내 말을 전할 권한은 친구에게 있었다. 혼자서는 모든 관객에게 닿을 수 없었다.', '누군가를 설득하는 데에도 소중한 시간이 들었다. 차단기를 내리면 즉시 공연을 멈출 수 있지만 친구는 이유를 모를 것이다.', '나는 통화 버튼 위에서 손을 멈췄다. 위험을 함께 알릴지, 혼자 전원을 끌지 마지막으로 결정해야 했다.'],
    ],
  },
  ja: {
    names: ['最初の選択', '配線の痕跡', '逃げ道を探して', '共に動く準備'],
    choices: ['舞台裏の配線を確かめる', '観客が避難できる道を先に探す'],
    lines: [
      ['翌日、私は早めに会場へ着いた。照明の下には水が落ちていたが、皆は準備に追われていた。', '舞台を見ているだけでは警告を止められない。危険の正体か、逃げ道を確かめる必要があった。', '配線は舞台裏へ続き、反対側には狭い出口があった。両方を調べる時間はない。', '先に得た情報が、友人に危険を伝える手がかりになる。私は足を止め、向かう先を選んだ。'],
      ['舞台裏で濡れた電線とひびの入った支柱を見つけた。触らずに写真を撮った。', '機材の担当者は席を外していた。観客は増え続け、開演まで十分しかなかった。', '証拠は手に入ったが、一人で直せる故障ではない。触ればかえって危険だった。', '私は安全な場所へ戻った。次は危険を知らせるか、電源を切るかを決めなければならない。'],
      ['出口をたどると、正面は混雑していたが、脇の扉は空いていて川沿いの道へ続いていた。', '入口の案内板を動かして通路を空けた。その間にも観客は増え続けていた。', '舞台の方で金属のきしむ音がした。逃げ道は分かったが、危険そのものは消えていない。', '私は友人のいる方へ戻った。次は危険を知らせるか、電源を切るかを決めなければならない。'],
      ['電話をかけるなら、舞台から離れてほしいとはっきり伝えよう。避難のお願いを短くまとめた。', '会場の放送を止め、私の言葉を届けられるのは友人だった。一人では観客全員に届かない。', '説得には大切な時間がかかる。電源を切ればすぐ公演は止まるが、友人は理由を知らないままだ。', '通話ボタンの上で手を止めた。共に危険を知らせるか、一人で電源を切るか。最後に決めなければならなかった。'],
    ],
  },
  en: {
    names: ['The first choice', 'Behind the wiring', 'A way out', 'Preparing to act together'],
    choices: ['Inspect the wiring behind the stage', 'Find a safe exit for the audience first'],
    lines: [
      ['I reached the festival early. Water dripped beneath the lighting rig, but everyone was absorbed in preparing the performance.', 'Watching the stage would not stop the warning. I needed to understand the danger or find a way for people to escape.', 'The cables led backstage; a narrow exit stood on the opposite side. There was not enough time to inspect both.', 'Whatever I learned first would help me explain the danger to my friend. I stopped and chose where to go.'],
      ['Behind the stage I found wet cables and a cracked support. I photographed them without touching anything.', 'The technician was away. More people were arriving, and the performance would begin in just ten minutes.', 'I had evidence, but this was not something I could repair alone. Touching the equipment might make things worse.', 'I stepped back to safety. Now I had to decide how to warn people or shut off the power.'],
      ['I followed the exit signs. The main entrance was crowded, but a side door opened onto a clear riverside path.', 'I moved an information board out of the passage. Even in those few moments, more spectators arrived.', 'Metal creaked above the stage. Finding an escape route had not removed the danger itself.', 'I headed back toward my friend. Now I had to decide how to warn people or shut off the power.'],
      ['If I called my friend, I would need a clear evacuation request. I rehearsed how to ask people to move away from the stage.', 'My friend could interrupt the announcements and reach the crowd. My own voice would never carry to everyone.', 'Convincing her would cost precious time. Cutting the power would stop the show immediately, but leave her without an explanation.', 'My thumb hovered above the call button. I still had to decide whether to share the warning or shut off the power alone.'],
    ],
  },
};

export function createQuickDemo(language: ContentLanguage) {
  const d = demos[language];
  const extra = investigations[language];
  const names = [d.scenes[0], extra.names[0], extra.names[1], extra.names[2], extra.names[3], d.scenes[2], d.scenes[3], d.scenes[4]];
  const lines = [d.lines[0], extra.lines[0], extra.lines[1], extra.lines[2], extra.lines[3], d.lines[2], d.lines[3], d.lines[4]];
  const targets = QUICK_TARGETS.map((choices, i) => i === 2 ? ['jeon_1'] : choices);
  return prepareQuickStory({
    title: d.title, description: d.description, startSceneId: 'ki_1',
    characters: [{ id: 'char_1', name: d.name, description: d.character, aiPrompt: 'Young adult student, casual blue jacket' }],
    scenes: QUICK_IDS.map((id, i) => ({
      id, name: names[i], stage: QUICK_STAGES[i], aiPrompt: 'Radio workshop, future warning, warm evening',
      presentCharacterIds: ['char_1'], dialogue: lines[i].map(text => ({ characterId: 'char_1', expressionId: 'char_1_expr_1', text })),
      choices: targets[i].map((nextSceneId, j) => ({ text: i === 1 ? extra.choices[j] : i === 5 ? d.choices[j] : d.next, nextSceneId })),
    })),
  }, language, 'demo');
}
