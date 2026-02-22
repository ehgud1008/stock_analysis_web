
### Response Description

Header
영문필드,한글필드,데이터타입,필수여부,길이,설명
cont-yn,	연속조회여부,	String,	N,	1,	다음 데이터가 있을시 Y값 전달
next-key, 연속조회키,	String,	N,	50,	다음 데이터가 있을시 다음 키값 전달
api-id,	TR명,	String,	Y,	10, 	

Body
영문필드,한글필드,데이터타입,필수여부,길이,설명
stk_cd,	종목코드,	String,	N,	6,
stk_min_pole_chart_qry,	주식분봉차트조회,	LIST,	N,		
  -cur_prc,	현재가,	String,	N,	20,
  -trde_qty,	거래량,	String,	N,	20,
  -cntr_tm,	체결시간,	String,	N,	20,
  -open_pric,	시가,	String,	N,	20,
  -high_pric,	고가,	String,	N,	20,
  -low_pric,	저가,	String,	N,	20,
  -pred_pre,	전일대비,	String,	N,	20,	현재가 - 전일종가
  -pred_pre_sig,	전일대비 기호,	String,	N,	20,	1:  상한가, 2:상승, 3:보합, 4:하한가, 5:하락

## Response Example
{
    "stk_cd": "005930",
    "stk_min_pole_chart_qry": [
        {
            "cur_prc": "-78800",
            "trde_qty": "7913",
            "cntr_tm": "20250917132000",
            "open_pric": "-78850",
            "high_pric": "-78900",
            "low_pric": "-78800",
            "acc_trde_qty": "14947571",
            "pred_pre": "-600",
            "pred_pre_sig": "5"
        },
        {
            "cur_prc": "-78900",
            "trde_qty": "16084",
            "cntr_tm": "20250917131900",
            "open_pric": "-78900",
            "high_pric": "-78900",
            "low_pric": "-78800",
            "acc_trde_qty": "14939658",
            "pred_pre": "-500",
            "pred_pre_sig": "5"
        },
    ],
    "return_code": 0,
    "return_msg": "정상적으로 처리되었습니다"
}