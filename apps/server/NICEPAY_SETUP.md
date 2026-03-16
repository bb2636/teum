# 나이스페이먼츠 연동 가이드

## 환경 변수 설정

`apps/server/.env` 파일에 다음 변수를 추가하세요:

```env
# Nice Payments 설정
NICEPAY_MERCHANT_ID=your_merchant_id
NICEPAY_API_KEY=your_api_key
NICEPAY_API_SECRET=your_api_secret
NICEPAY_BASE_URL=https://webapi.nicepay.co.kr
NICEPAY_TEST_MODE=true  # 테스트 모드: true, 운영 모드: false
```

## 테스트 모드

`NICEPAY_TEST_MODE=true`로 설정하면:
- 실제 결제 API를 호출하지 않고 시뮬레이션만 수행
- 항상 성공 응답 반환
- 테스트용 Transaction ID 생성

## 운영 모드

`NICEPAY_TEST_MODE=false`로 설정하고 실제 인증 정보를 입력하면:
- 실제 나이스페이먼츠 API 호출
- 실제 결제 처리
- 실제 Transaction ID 반환

## 나이스페이먼츠 계정 정보 확인

1. 나이스페이먼츠 관리자 페이지 로그인
2. 상점 정보에서 다음 정보 확인:
   - **상점 ID (Merchant ID)**: `NICEPAY_MERCHANT_ID`
   - **API Key**: `NICEPAY_API_KEY`
   - **API Secret**: `NICEPAY_API_SECRET`

## 테스트 결제

### 테스트 카드 번호 (나이스페이먼츠 제공)

나이스페이먼츠 테스트 환경에서 사용할 수 있는 테스트 카드 번호는 나이스페이먼츠 개발자 문서를 참고하세요.

일반적인 테스트 카드:
- 카드번호: `4111-1111-1111-1111`
- 유효기간: 현재 날짜 이후
- CVV: `123`
- 비밀번호: `1234` (간편결제)

## API 엔드포인트

### 결제 승인
- **엔드포인트**: `POST /api/payments/process`
- **요청 본문**:
  ```json
  {
    "amount": 9900,
    "planName": "프리미엄 플랜",
    "paymentMethod": "card",
    "cardCompany": "신한카드"
  }
  ```

### 결제 취소 (환불)
- **엔드포인트**: `POST /api/payments/cancel`
- **요청 본문**:
  ```json
  {
    "tid": "transaction_id",
    "amount": 9900,
    "reason": "고객 요청"
  }
  ```

## 웹훅 설정

나이스페이먼츠에서 결제 완료 시 자동으로 호출되는 웹훅 URL:
```
http://your-domain.com/api/payments/webhook
```

웹훅을 받으려면 추가 구현이 필요합니다.

## 문제 해결

### "Nice Payments credentials not fully configured"
- 환경 변수가 제대로 설정되지 않았습니다
- `.env` 파일을 확인하고 서버를 재시작하세요

### "Nice Payments API error"
- API 키나 시크릿이 잘못되었을 수 있습니다
- 나이스페이먼츠 관리자 페이지에서 키를 확인하세요
- 테스트 모드로 전환하여 테스트하세요

### 결제가 실패하는 경우
- 나이스페이먼츠 로그 확인
- API 응답의 `errorCode`와 `errorMsg` 확인
- 나이스페이먼츠 고객지원 문의

## 참고 문서

- 나이스페이먼츠 개발자 문서: https://developers.nicepay.co.kr
- API 레퍼런스: 나이스페이먼츠 관리자 페이지 > 개발자 센터
