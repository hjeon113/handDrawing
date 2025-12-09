let handPose,
  video,
  hands = [];
// handPose: 손 인식 AI 모델
// video: 웹캠 영상
// hands: 감지된 손 데이터 저장 배열

let brushSize = 10,
  brushColor = { r: 0, g: 255, b: 255 };
// brushSize: 브러시 굵기 (기본 10)
// brushColor: HSB 색상 (r=색조, g=채도, b=밝기)

let brushShape = "circle";
// brushShape: 브러시 모양 (circle, square)

let shapeJustSwitched = false;
// shapeJustSwitched: 도형 전환 중복 방지

let prevDrawTip = null,
  drawingLayer;
// prevDrawTip: 이전 프레임 손가락 좌표 (선 연결용)
// drawingLayer: 그림 저장 레이어

const VW = 320,
  VH = 240,
  BAR_W = 25;
// VW, VH: 웹캠 크기
// BAR_W: 컬러바 너비

let W, H, WIN_X, WIN_Y, BAR_X;
// W, H: 캔버스 크기 (브라우저 전체)
// WIN_X: 웹캠 X좌표 (화면 중앙)
// WIN_Y: 웹캠 Y좌표 (상단 40px)
// BAR_X: 컬러바 X좌표 (웹캠 바로 왼쪽)

function preload() {
  handPose = ml5.handPose({ maxHands: 4, modelType: "full" });
}
// 시작 전 손 인식 모델 로드
// maxHands: 4 = 최대 2명, modelType: full = 더 정확

function setup() {
  W = windowWidth; // 브라우저 너비
  H = windowHeight; // 브라우저 높이
  WIN_X = (W - VW) / 2; // 웹캠 중앙 정렬
  WIN_Y = 40;
  BAR_X = WIN_X - BAR_W;

  createCanvas(W, H); // 캔버스 생성 (전체 화면)
  video = createCapture(VIDEO); // 웹캠 시작
  video.size(VW, VH); // 웹캠 크기 설정
  video.hide(); // HTML 비디오 숨김
  drawingLayer = createGraphics(W, H); // 그림 레이어 생성
  handPose.detectStart(video, (r) => (hands = r)); // 손 인식 시작

  // 키보드 이벤트 (window 레벨, 한영 상관없이)
  window.addEventListener("keydown", (e) => {
    if (e.keyCode === 82) {
      // R키 (한글 ㄱ)
      drawingLayer.clear();
      prevDrawTip = null;
    }
    if (e.keyCode === 83) {
      // S키 (한글 ㄴ)
      // 날짜시간 포맷: handDrawing_YYYYMMDD_HHMMSS
      let now = new Date();
      let filename =
        "handDrawing_" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "_" +
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0");
      drawingLayer.save(filename + ".png");
    }
  });
}

function windowResized() {
  W = windowWidth;
  H = windowHeight;
  WIN_X = (W - VW) / 2;
  BAR_X = WIN_X - BAR_W;
  resizeCanvas(W, H);

  // 그림 레이어도 새로 만들어야 함 (기존 그림 유지 안됨)
  let oldLayer = drawingLayer;
  drawingLayer = createGraphics(W, H);
  drawingLayer.image(oldLayer, 0, 0);
}

function draw() {
  background(255); // 흰색 배경
  rectMode(CORNER); // rectMode 리셋
  colorMode(RGB); // colorMode 리셋
  image(drawingLayer, 0, 0); // 그림 레이어 표시

  // 컬러바 (무지개 그라데이션)
  colorMode(HSB, 360, 255, 255);
  noStroke();
  for (let y = 0; y < VH; y++) {
    fill(map(y, 0, VH, 0, 360), 255, 255); // y → 색조(0~360)
    rect(BAR_X, WIN_Y + y, BAR_W, 1);
  }
  colorMode(RGB);

  // 라임색 테두리
  stroke(200, 255, 0);
  strokeWeight(4);
  noFill();
  rect(BAR_X - 2, WIN_Y - 22, BAR_W + VW + 4, VH + 24);
  fill(200, 255, 0);
  noStroke();
  rect(BAR_X, WIN_Y - 20, BAR_W + VW, 20); // 타이틀바

  //    함수명    입력값   리턴값
  const mirror = (x) => WIN_X + VW - x; // 좌표 반전 함수

  // 손 구분 (거울이라 Left↔Right 반대)
  let controlHand = null,
    drawHand = null;
  for (let hand of hands) {
    if (hand.handedness === "Left") controlHand = hand; // 화면상 오른손
    else if (hand.handedness === "Right") drawHand = hand; // 화면상 왼손
  }

  // 웹캠 영역 (검은 배경 + 스켈레톤)
  fill(0);
  noStroke();
  rect(WIN_X, WIN_Y, VW, VH);

  // 손 스켈레톤 그리기 (웹캠 안에만)
  const fingerConnections = [
    [0, 1, 2, 3, 4], // 엄지
    [0, 5, 6, 7, 8], // 검지
    [0, 9, 10, 11, 12], // 중지
    [0, 13, 14, 15, 16], // 약지
    [0, 17, 18, 19, 20], // 새끼
    [5, 9, 13, 17], // 손바닥
  ];

  // 관련 손가락 인덱스
  const controlFingers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 엄지, 검지, 중지
  const drawFingers = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // 엄지, 검지

  // 클리핑 (웹캠 영역 안에만 그리기)
  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(WIN_X, WIN_Y, VW, VH);
  drawingContext.clip();

  for (let hand of hands) {
    let kp = hand.keypoints;
    let isDrawHand = hand === drawHand;
    let isControlHand = hand === controlHand;
    let activeFingers = isDrawHand
      ? drawFingers
      : isControlHand
      ? controlFingers
      : [];

    // 선 연결
    strokeWeight(2);
    for (let conn of fingerConnections) {
      for (let i = 0; i < conn.length - 1; i++) {
        let p1 = kp[conn[i]];
        let p2 = kp[conn[i + 1]];
        // 두 점 모두 활성 손가락이면 라임색
        let isActive =
          activeFingers.includes(conn[i]) &&
          activeFingers.includes(conn[i + 1]);
        stroke(isActive ? color(200, 255, 0) : color(255));
        line(mirror(p1.x), WIN_Y + p1.y, mirror(p2.x), WIN_Y + p2.y);
      }
    }

    // 관절 점
    noStroke();
    for (let j = 0; j < kp.length; j++) {
      let p = kp[j];
      let isActive = activeFingers.includes(j);
      fill(isActive ? color(200, 255, 0) : color(255));
      circle(mirror(p.x), WIN_Y + p.y, 6);
    }
  }

  drawingContext.restore();
  pop();

  // 오른손: 브러시 크기 조절 + 도형 변경
  if (controlHand) {
    let thumb = controlHand.keypoints[4]; // 엄지 끝
    let index = controlHand.keypoints[8]; // 검지 끝
    let middle = controlHand.keypoints[12]; // 중지 끝

    // 손가락 거리(5~150) → 브러시 크기(3~80)
    brushSize = constrain(
      map(dist(thumb.x, thumb.y, index.x, index.y), 5, 150, 3, 80),
      3,
      50
    );

    // 엄지-중지 거리로 도형 변경
    let switchDist = dist(thumb.x, thumb.y, middle.x, middle.y);
    if (switchDist < 30 && !shapeJustSwitched) {
      brushShape = brushShape === "circle" ? "square" : "circle";
      shapeJustSwitched = true;
    }
    if (switchDist > 50) {
      shapeJustSwitched = false;
    }

    // 시각화 (라임색)
    stroke(200, 255, 0);
    strokeWeight(2);
    // 엄지와 검지를 연결하는 선 (사이즈)
    line(mirror(thumb.x), WIN_Y + thumb.y, mirror(index.x), WIN_Y + index.y);
    // 엄지와 중지를 연결하는 선 (도형)
    line(mirror(thumb.x), WIN_Y + thumb.y, mirror(middle.x), WIN_Y + middle.y);

    fill(200, 255, 0);
    noStroke();
    circle(mirror(thumb.x), WIN_Y + thumb.y, 10);
    circle(mirror(index.x), WIN_Y + index.y, 10);
    circle(mirror(middle.x), WIN_Y + middle.y, 10);

    textAlign(RIGHT);
    text("size", mirror(index.x) - 15, WIN_Y + index.y - 5);
    text(brushShape, mirror(middle.x) - 15, WIN_Y + middle.y - 5);
  }

  // 왼손: 색상 선택 + 드로잉
  if (drawHand) {
    let tip = drawHand.keypoints[8]; // 검지 끝
    let thumb = drawHand.keypoints[4]; // 엄지 끝
    let vx = VW - tip.x,
      vy = tip.y; // 반전 좌표

    // 엄지-검지 거리로 드로잉 on/off
    let pinchDist = dist(thumb.x, thumb.y, tip.x, tip.y);
    let isDrawing = pinchDist > 25; // 25px 이상 벌리면 그리기 (더 가까이 해야 pause)

    // 엄지-검지 라인 항상 표시 (상태에 따라 색상 변경)
    if (isDrawing) {
      // 그리기 상태 - 라임색
      stroke(200, 255, 0);
    } else {
      // 홀드 상태 - 빨간색
      stroke(255, 100, 100);
    }
    strokeWeight(2);
    line(mirror(thumb.x), WIN_Y + thumb.y, mirror(tip.x), WIN_Y + tip.y);

    if (isDrawing) {
      fill(200, 255, 0);
    } else {
      fill(255, 100, 100);
    }
    noStroke();
    circle(mirror(thumb.x), WIN_Y + thumb.y, 10);
    textAlign(LEFT);
    text(
      isDrawing ? "draw" : "pause",
      mirror(thumb.x) + 15,
      WIN_Y + thumb.y - 5
    );

    if (vx < VW * 0.25) {
      // 왼쪽 25% = 색상 선택 영역 (그리기 안 됨)
      brushColor.r = map(vy, 0, VH, 0, 360); // Y값 → 색조
      prevDrawTip = null; // 색상 영역에서는 선 끊기
    } else {
      // 나머지 75% = 그리기 영역 → 캔버스 전체로 매핑
      let mx = map(vx, VW * 0.25, VW, 0, W);
      let my = map(vy, VH * 0.1, VH * 0.9, 0, H);

      // 커서 항상 표시 (pause 상태에서도)
      colorMode(HSB, 360, 255, 255);
      if (isDrawing) {
        fill(brushColor.r, brushColor.g, brushColor.b, 150);
      } else {
        // pause 상태 - 반투명 빨간 커서
        fill(0, 255, 255, 100);
      }
      noStroke();
      if (brushShape === "circle") {
        circle(mx, my, brushSize);
      } else {
        rectMode(CENTER);
        rect(mx, my, brushSize, brushSize);
      }
      colorMode(RGB);

      if (isDrawing) {
        // 손가락 벌리면 그리기
        drawingLayer.colorMode(HSB, 360, 255, 255, 255);
        if (prevDrawTip) {
          // 이전 좌표 있으면 선 연결
          drawingLayer.stroke(brushColor.r, brushColor.g, brushColor.b, 100);
          drawingLayer.strokeWeight(brushSize);
          drawingLayer.line(prevDrawTip.x, prevDrawTip.y, mx, my);
        }
        drawingLayer.noStroke();
        drawingLayer.fill(brushColor.r, brushColor.g, brushColor.b, 100);

        // 브러시 모양에 따라 그리기
        if (brushShape === "circle") {
          drawingLayer.circle(mx, my, brushSize);
        } else if (brushShape === "square") {
          drawingLayer.rectMode(CENTER);
          drawingLayer.rect(mx, my, brushSize, brushSize);
        }
        prevDrawTip = { x: mx, y: my };
      } else {
        prevDrawTip = null; // 손가락 모으면 선 끊기
      }
    }

    // 웹캠 위 손가락 표시 (현재 색상)
    colorMode(HSB, 360, 255, 255);
    fill(brushColor.r, brushColor.g, brushColor.b);
    stroke(255);
    strokeWeight(2);
    circle(mirror(tip.x), WIN_Y + tip.y, 15);
    colorMode(RGB);
  } else {
    prevDrawTip = null;
  }
}
