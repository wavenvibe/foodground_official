import StatePanel from "@/components/StatePanel";

export default function FacilityNotFound() {
  return (
    <main className="page-container">
      <StatePanel
        title="제조시설을 찾을 수 없습니다"
        description="삭제되었거나 공개되지 않은 업체일 수 있습니다."
        actionHref="/facilities"
        actionLabel="업체 검색으로"
      />
    </main>
  );
}
