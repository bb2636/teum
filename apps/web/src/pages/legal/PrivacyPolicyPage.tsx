export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#4A2C1A] mb-8">개인정보처리방침</h1>

        <p className="text-sm text-gray-500 mb-6">시행일: 2025년 1월 1일</p>

        <div className="space-y-8 text-sm text-gray-800 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">1. 개인정보의 수집 항목 및 수집 방법</h2>
            <p className="mb-2">Teum(이하 "서비스")은 서비스 제공을 위해 아래의 개인정보를 수집합니다.</p>
            <p className="font-medium mb-1">가. 회원가입 시 수집 항목</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>이메일 주소, 비밀번호(이메일 가입의 경우)</li>
              <li>소셜 로그인 시: 이름, 이메일 주소, 프로필 사진, 소셜 계정 고유 식별자</li>
              <li>닉네임, 생년월일, 성별, 국가</li>
            </ul>
            <p className="font-medium mb-1 mt-3">나. 서비스 이용 과정에서 수집되는 항목</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>일기 내용(텍스트, 이미지)</li>
              <li>AI 분석 결과(감정 분석, 요약)</li>
              <li>음악 생성 기록</li>
              <li>결제 정보(결제 수단, 결제 일시, 구독 상태)</li>
              <li>기기 정보, 접속 로그, IP 주소</li>
            </ul>
            <p className="font-medium mb-1 mt-3">다. 수집 방법</p>
            <p>회원가입, 소셜 로그인(Google, Apple), 서비스 이용 과정에서 자동 수집</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 본인 인증</li>
              <li>일기 작성, 저장 및 관리 서비스 제공</li>
              <li>AI 기반 감정 분석 및 음악 생성 서비스 제공</li>
              <li>구독 결제 처리 및 관리</li>
              <li>고객 문의 대응 및 서비스 개선</li>
              <li>서비스 이용 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">3. 개인정보의 보유 및 이용 기간</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다.</li>
              <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                  <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
                  <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
                  <li>접속에 관한 기록: 3개월 (통신비밀보호법)</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">4. 개인정보의 제3자 제공</h2>
            <p className="mb-2">서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차에 따라 요청이 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">5. 개인정보 처리 위탁</h2>
            <p className="mb-2">서비스는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left">수탁업체</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Google LLC</td>
                    <td className="border border-gray-200 px-3 py-2">소셜 로그인 인증</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Apple Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">소셜 로그인 인증</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">OpenAI</td>
                    <td className="border border-gray-200 px-3 py-2">AI 감정 분석 및 음악 생성</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">나이스페이먼츠</td>
                    <td className="border border-gray-200 px-3 py-2">결제 처리</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">6. 이용자의 권리 및 행사 방법</h2>
            <p className="mb-2">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>개인정보 열람, 정정, 삭제 요청</li>
              <li>개인정보 처리 정지 요청</li>
              <li>회원 탈퇴</li>
            </ul>
            <p className="mt-2">위 권리는 앱 내 설정 또는 고객센터를 통해 행사할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">7. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 암호화 저장(bcrypt)</li>
              <li>SSL/TLS를 통한 데이터 전송 암호화</li>
              <li>접근 권한 제한 및 관리</li>
              <li>개인정보 접근 로그 기록 및 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">8. 개인정보 보호책임자</h2>
            <ul className="list-none space-y-1">
              <li>이메일: iteraon.teum@gmail.com</li>
            </ul>
            <p className="mt-2">개인정보 관련 문의사항은 위 이메일로 연락해 주시기 바랍니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-2">9. 개인정보처리방침의 변경</h2>
            <p>본 개인정보처리방침은 법령 및 서비스 변경사항을 반영하여 수정될 수 있으며, 변경 시 앱 내 공지를 통해 안내합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">© Teum. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
