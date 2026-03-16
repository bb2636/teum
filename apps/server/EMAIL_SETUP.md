# 이메일 발송 설정 가이드

teum 서비스에서 이메일 발송 기능을 설정하는 방법입니다.

## 개요

이메일 발송은 다음 기능에서 사용됩니다:
- 비밀번호 재설정 링크 발송
- 환영 이메일 (선택적)

## 환경 변수 설정

`.env` 파일에 다음 변수들을 추가하세요:

```env
# 이메일 발송 활성화
EMAIL_ENABLED=true

# 발신자 이메일 주소
EMAIL_FROM=noreply@teum.com
EMAIL_USER=your-email@gmail.com

# 이메일 서비스 설정
EMAIL_SERVICE=gmail  # 또는 'smtp'
EMAIL_PASSWORD=your-app-password  # Gmail의 경우 App Password 필요

# 또는 SMTP 직접 설정
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false  # 587은 false, 465는 true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Gmail 설정 방법

### 1. 2단계 인증 활성화

1. [Google 계정 설정](https://myaccount.google.com/) 접속
2. 보안 → 2단계 인증 활성화

### 2. App Password 생성

1. [App Passwords](https://myaccount.google.com/apppasswords) 페이지 접속
2. "앱 선택" → "기타(맞춤 이름)" 선택
3. 이름 입력 (예: "teum-server")
4. "생성" 클릭
5. 생성된 16자리 비밀번호 복사 (공백 없이)

### 3. 환경 변수 설정

```env
EMAIL_ENABLED=true
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # App Password (공백 제거 가능)
EMAIL_FROM=noreply@teum.com
```

## 다른 이메일 서비스 설정

### SendGrid

```env
EMAIL_ENABLED=true
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@teum.com
```

### AWS SES

```env
EMAIL_ENABLED=true
EMAIL_SERVICE=smtp
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # 리전에 따라 변경
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-aws-ses-smtp-username
SMTP_PASSWORD=your-aws-ses-smtp-password
EMAIL_FROM=noreply@teum.com
```

### Mailgun

```env
EMAIL_ENABLED=true
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-smtp-username
SMTP_PASSWORD=your-mailgun-smtp-password
EMAIL_FROM=noreply@teum.com
```

## 개발 환경

개발 환경에서는 이메일 발송을 비활성화하고 콘솔에 토큰을 출력할 수 있습니다:

```env
EMAIL_ENABLED=false
```

이 경우 비밀번호 재설정 토큰이 응답에 포함되어 테스트할 수 있습니다.

## 테스트

이메일 발송이 제대로 작동하는지 테스트:

1. 환경 변수 설정 확인
2. 서버 재시작
3. 비밀번호 재설정 요청
4. 이메일 수신 확인

## 문제 해결

### "Invalid login" 오류

- Gmail의 경우 App Password를 사용해야 합니다 (일반 비밀번호 불가)
- 2단계 인증이 활성화되어 있어야 합니다

### "Connection timeout" 오류

- 방화벽에서 SMTP 포트(587, 465)가 차단되지 않았는지 확인
- `SMTP_SECURE` 설정 확인 (587은 false, 465는 true)

### 이메일이 스팸으로 분류되는 경우

- SPF, DKIM, DMARC 레코드 설정
- 발신자 도메인 인증
- 이메일 서비스 제공업체의 가이드 따르기

## 보안 권장사항

1. **환경 변수 보호**: `.env` 파일을 버전 관리에 포함하지 마세요
2. **App Password 사용**: Gmail의 경우 일반 비밀번호 대신 App Password 사용
3. **도메인 인증**: 프로덕션에서는 발신자 도메인을 인증하세요
4. **Rate Limiting**: 이메일 발송에 Rate Limiting 적용 고려
