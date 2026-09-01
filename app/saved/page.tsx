"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  loadSaved,
  SAVED_KEYS,
  writeSaved,
  type SavedFacility,
  type SavedProduct,
  type SavedRecipe,
  type SavedSubstitute,
} from "@/lib/saved-items";

export default function SavedPage() {
  const [mounted, setMounted] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [substitutes, setSubstitutes] = useState<SavedSubstitute[]>([]);
  const [facilities, setFacilities] = useState<SavedFacility[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);

  useEffect(() => {
    // Read browser-only persistence after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecipes(loadSaved(SAVED_KEYS.recipes));
    setSubstitutes(loadSaved(SAVED_KEYS.substitutes));
    setFacilities(loadSaved(SAVED_KEYS.facilities));
    setProducts(loadSaved(SAVED_KEYS.products));
    setMounted(true);
  }, []);

  function removeRecipe(id: string) {
    const next = recipes.filter((item) => item.recipe_id !== id);
    writeSaved(SAVED_KEYS.recipes, next);
    setRecipes(next);
  }

  function removeSubstitute(id: string) {
    const next = substitutes.filter((item) => item.standard_food_id !== id);
    writeSaved(SAVED_KEYS.substitutes, next);
    setSubstitutes(next);
  }

  function removeFacility(id: string) {
    const next = facilities.filter((item) => item.mgt_no !== id);
    writeSaved(SAVED_KEYS.facilities, next);
    setFacilities(next);
  }

  function removeProduct(id: string) {
    const next = products.filter((item) => item.report_no !== id);
    writeSaved(SAVED_KEYS.products, next);
    setProducts(next);
  }

  const total = recipes.length + substitutes.length + facilities.length + products.length;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading review-heading">
          <div>
            <p className="eyebrow">PRODUCT REVIEW BASKET</p>
            <h1>제품화 검토함</h1>
            <p>레시피·대체재료·제품·제조시설을 장바구니처럼 모아두고 다음 검토로 이어갑니다.</p>
          </div>
          <strong className="review-total">{mounted ? total : 0}개 저장</strong>
        </header>
        <aside className="data-note">저장 내용은 로그인이나 서버 전송 없이 현재 브라우저에만 보관됩니다. 브라우저 데이터를 삭제하면 함께 사라집니다.</aside>

        <div className="review-sections">
          <section className="review-section" aria-labelledby="saved-recipes">
            <div className="review-section__head"><div><h2 id="saved-recipes">레시피</h2><p>제품 아이디어와 재료 구성을 다시 확인합니다.</p></div><Link className="button button--secondary" href="/recipes">레시피 찾기</Link></div>
            {!mounted ? null : recipes.length === 0 ? <p className="review-empty">저장한 레시피가 없습니다.</p> : <ul className="review-list">{recipes.map((item) => <li key={item.recipe_id}><div><Link href={`/recipes/${encodeURIComponent(item.recipe_id)}`}><strong>{item.title}</strong></Link><small>{item.category || "분류 정보 없음"}</small></div><button type="button" onClick={() => removeRecipe(item.recipe_id)}>제거</button></li>)}</ul>}
          </section>

          <section className="review-section" aria-labelledby="saved-substitutes">
            <div className="review-section__head"><div><h2 id="saved-substitutes">대체 식재료</h2><p>어떤 원재료 대신 검토했는지 함께 보관합니다.</p></div><Link className="button button--secondary" href="/substitutes">대체재료 찾기</Link></div>
            {!mounted ? null : substitutes.length === 0 ? <p className="review-empty">저장한 대체 식재료가 없습니다.</p> : <ul className="review-list">{substitutes.map((item) => <li key={item.standard_food_id}><div><Link href={`/substitutes?ingredient=${encodeURIComponent(item.source_ingredient)}`}><strong>{item.name}</strong></Link><small>{item.source_ingredient} 대체 · {item.score_final == null ? "점수 없음" : `${Math.round(item.score_final * 100)}점`}</small></div><button type="button" onClick={() => removeSubstitute(item.standard_food_id)}>제거</button></li>)}</ul>}
          </section>

          <section className="review-section review-section--factory" aria-labelledby="saved-facilities">
            <div className="review-section__head"><div><h2 id="saved-facilities">제조 후보</h2><p>조건 검색에서 저장한 시설을 근거별로 비교합니다.</p></div><div className="review-section__actions"><Link className="button button--secondary" href="/facilities">후보 더 찾기</Link><Link className="button button--point" href="/facilities/compare">저장 후보 비교</Link></div></div>
            {!mounted ? null : facilities.length === 0 ? <p className="review-empty">저장한 제조시설이 없습니다. 시설 검색 결과에서 ‘검토함에 저장’을 눌러보세요.</p> : <ul className="review-list">{facilities.map((item) => <li key={item.mgt_no}><div><Link href={`/facilities/${encodeURIComponent(item.mgt_no)}`}><strong>{item.name}</strong></Link><small>{[item.region_sido, item.region_sigungu].filter(Boolean).join(" ") || "지역 정보 없음"} · {item.is_haccp ? "HACCP 인증" : "HACCP 연결정보 없음"}</small></div><button type="button" onClick={() => removeFacility(item.mgt_no)}>제거</button></li>)}</ul>}
          </section>

          {products.length > 0 ? <section className="review-section" aria-labelledby="saved-products"><div className="review-section__head"><div><h2 id="saved-products">기존 제품</h2><p>생산 이력과 제조업체 연결 근거를 확인합니다.</p></div><Link className="button button--secondary" href="/products">제품 찾기</Link></div><ul className="review-list">{products.map((item) => <li key={item.report_no}><div><Link href={`/products/${encodeURIComponent(item.report_no)}`}><strong>{item.product_name}</strong></Link><small>{item.facility_name || "제조업체 연결정보 없음"}</small></div><button type="button" onClick={() => removeProduct(item.report_no)}>제거</button></li>)}</ul></section> : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
