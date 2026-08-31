import StatePanel from "@/components/StatePanel";

export default function ProductNotFound() {
  return <StatePanel title="제품을 찾을 수 없습니다" description="품목보고번호가 존재하지 않거나 공개 원본에서 제외된 제품입니다." actionHref="/products" actionLabel="제품 검색으로" />;
}
