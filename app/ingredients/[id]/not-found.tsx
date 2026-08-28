import StatePanel from "@/components/StatePanel";

export default function IngredientNotFound() {
  return (
    <main className="page-container">
      <StatePanel
        title="식재료를 찾을 수 없습니다"
        description="삭제되었거나 존재하지 않는 식재료입니다."
        actionHref="/ingredients"
        actionLabel="식재료 검색으로"
      />
    </main>
  );
}
