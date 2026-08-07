# Rendezvous 3D Panel

宇宙機のランデブー運用に用いられるテレメトリを3D空間で俯瞰できるGrafanaパネルプラグインです。位置・姿勢・イベントを同じシーンで確認でき、運用オペレーションの共有理解を高めます。

## 表示例

### 探査機とターゲット小惑星の相対配置
![探査機とターゲットの表示例](screenshots/display1_haya2.png)
複数のオブジェクト（例: 探査機、ターゲット天体、誘導用マーカー）を登録し、姿勢付き3Dモデルと球体マーカー、時系列ポリラインで相対位置と軌跡を一画面で確認できます。

### イベント注釈を重ねた運用ログビュー
![注釈表示例](screenshots/display2_anot.png)
アノテーションオブジェクトを使うと、特定イベントの時刻・メモをデータソースと連動させて表示できます。ライン方向を切り替えて視認性を調整可能です。

### ランデブー全体の俯瞰
![マルチオブジェクト表示例](screenshots/display3.png)
カメラのターゲットを切り替えながら、複数の物体を俯瞰表示。スケール調整によりローカルなドッキング操作から広域の航行状況まで同じシーンで確認できます。

## パネル設定ガイド

### 1. ライティングと背景
<img src="screenshots/menu1_light.png" alt="ライティング設定" width="250" />
- `Background Color` で宇宙空間を模した背景色や運用環境に合わせた色味を指定
- `Ambient Light Intensity`（0で完全にオフ）を調整して金属質な機体やマーカーの見え方を整えます
- `Point Light` を有効にすると、シーン内に1つだけ点光源を配置できます。位置はオブジェクトと同様にテレメトリフィールドまたは定数で設定可能です。光はSphereや3Dモデルの表面（前面）で遮蔽され、裏面は透過するため、太陽光や局所的な光源による陰影表現に利用できます。
  - `Point Light Decay` で距離による減衰方法を選択できます: `None`（距離によらず一定）、`Linear`（1/d）、`Inverse Square`（1/d²、物理的に正確な減衰）。シーンの規模は数十単位から10^8を大きく超える範囲まで様々なため、手軽に使いたい場合は `None`、物理的な減衰を再現したい場合は `Linear`/`Inverse Square` を選び、`Point Light Intensity` をその分大きめに設定してください。

### 2. 視野角ベースの自動スケーリング
<img src="screenshots/menu2_autoscale.png" alt="自動スケーリング設定" width="250" />
- `Target Angular Size` と `Min/Max Size` を設定すると、距離に応じて球体（Sphere）や3Dモデルのサイズを自動調整
- Auto Radius / Auto Scale を有効にしたオブジェクトのみが対象となり、遠距離での視認性と近接時の判別しやすさを両立します

アルゴリズムは `ViewAngleScaling.calculateViewBasedScale`（`src/components/utils/ViewAngleScaling.ts`）で実装されています。シーン描画ごとに `ThreeSceneObjectManager.updateViewAngleScaling` が呼び出され、以下の処理を行います。

1. カメラ座標とオブジェクト座標のユークリッド距離 `d` を計算します。
2. 設定値 `targetAngularSize`（ラジアン）を用い、視野角が一定になる物理サイズ `S = 2 * d * tan(targetAngularSize / 2)` を導出します。
3. オブジェクトのバウンディングボックス最大長 `L`（Sphereでは直径、3D Modelではモデル読み込み時に計測）を取得し、必要スケール `scaleRaw = S / L` を算出します。
4. `minSize` と `maxSize` で `scaleRaw` をクランプし、アスペクト比補正 `applyShapeAdjustment` を掛けた後、`userData.originalScale`（モデルのunit変換を含む）と乗算して最終スケールを得ます。旧ダッシュボードでは、保存済みのオブジェクト別倍率も互換目的で適用されます。

この計算はカメラが移動した直後にも適用されるため、ズーム操作に追従して常に同じ画角でオブジェクトが表示されます。Auto Radiusを無効にすると指定した半径を使用し、Auto Scaleを無効にするとunit変換後の3Dモデル固有サイズを使用します。

### 3. カメラ制御と注視対象
<img src="screenshots/menu3_camera.png" alt="カメラ設定" width="250" />
- テレメトリフィールドや定数を用いてカメラ位置を制御。Fieldを指定した座標はフィールドの最新値を使用し、Grafanaから新しいパネルデータが渡されるたびに更新されます。全座標がConstantの場合、データ更新による再適用は行いません
- `Enable Controls` を有効にするとGrafana上でマウスドラッグによる自由視点操作が可能
- `Target Object` を設定すると指定オブジェクトを中心にカメラが追従します
- エディタの `Get Current Camera Position` をクリックすると、マウス操作で動かした現在のカメラ位置を `Pos X/Y/Z` の定数値として保存できます
- パネル画面上にも同じ操作を行うための2つのボタンが表示されます（エディタを開かなくても操作可能）:
  - **Save Camera Position**: 現在のカメラ位置をパネル設定に保存します（`Get Current Camera Position` と同等）
  - **Reset Camera**: 保存済み（または既定）のカメラ位置に即座に戻します。リロードは不要です
  - カメラ位置設定欄の近くにあるチェックボックス `Show "Save Camera Position" Button` / `Show "Reset Camera" Button` で、各ボタンの表示・非表示を個別に切り替えられます（デフォルトはどちらもON）

### 4. オブジェクト管理
<img src="screenshots/menu4_objects.png" alt="オブジェクト管理" width="250" />
- 任意の数のオブジェクトを追加し、表示順や可視状態をパネル内で切り替えます
- `Add Object` から形状タイプ（Sphere / 3D Model / Polyline / Annotation）を選択

### 5. オブジェクト一覧と並び替え
<img src="screenshots/menu5_objectlist.png" alt="オブジェクト一覧" width="250" />
- 右側のハンドラで並び順を変更し、手前に描画する要素を調整
- `Visible` スイッチで一時的な表示切り替えが可能

### 6. Sphere（球体）オブジェクト
<img src="screenshots/menu6_sphere.png" alt="Sphere設定" width="250" />
- 位置（Pos X/Y/Z）にテレメトリを割り当て、可視化対象を球体で表現
- 半径を直接指定するか、`Auto Radius` を有効にして視野角ベースで自動決定
- `Brightness` を固定値またはフィールド連動で設定し、球体を暗くする（詳細は後述の[Brightness](#brightness)を参照）

### 7. 3D Model オブジェクト
<img src="screenshots/menu7_3dmodel.png" alt="3Dモデル設定" width="250" />
- GLTF等のURLを指定すると宇宙機モデルを読み込み、未指定時は基準となるキューブを自動描画
- 位置とクォータニオン（Quat X/Y/Z/W）をテレメトリに紐づけて姿勢表示
- モデル単位の `Interpolation` 設定により、データ更新間の姿勢変化を滑らかに表示
- `Unit` を `km` / `m` から選択してスケール補正
- `Auto Scale` 有効時は視野角ベースで表示サイズを調整し、無効時はモデル固有サイズを使用
- `Brightness` を固定値またはフィールド連動で設定し、モデルを暗くする（詳細は後述の[Brightness](#brightness)を参照）

#### Brightness

Sphere と 3D Model オブジェクトには `Brightness`（明るさ）の設定があります（Polyline と Annotation は実体を持たないマーカーのため対象外です）。位置やクォータニオンと同様に、固定値（`Const`）とフィールド連動（`Field`）を切り替えられます。

- `Const`（既定値 `1`）: 固定値。`0`（真っ黒）〜`1`（変化なし）の範囲で指定します。
- `Field`: 数値フィールドの最新値をデータ更新のたびに反映します。`1` を超える値は `1` に、`0` を下回る値は `0` に飽和します。

Brightness はオブジェクト自体の色を黒に向けて乗算するだけで、不透明度（opacity）や透過設定は一切変更しません。同じ光の当たり方のまま、常に完全に不透明な実体として他のオブジェクトを正しく遮蔽し続け（透明化に伴う描画順の問題も起きません）、単に反射光が減って暗く見えるだけです。Brightness はモデル自体が持つマテリアル設定の上から色だけを暗くするため、元々半透明なマテリアルを持つモデルはその半透明さを保ったまま色だけが暗くなります。

#### クォータニオン内挿・外挿

補完は3Dモデルごとに個別設定します。Quaternion X / Y / Z / W がすべて `Field` の場合だけ有効です。無効時や `Const` が混在する場合は、従来どおり各フィールドの最新値を使用します。

- `Enable`: リフレッシュをまたいで時刻付きクォータニオンを保持し、Grafanaの表示範囲終端へslerpします。
- `Time Field`: サンプル時刻に使うフィールドです。空欄では4成分を含むフレームの時刻フィールドを自動検出します。`Series.Field`、`[Series]{Field}`、裸のフィールド名を指定できます。
- `Retained Samples`: モデルごとの固定長履歴です。既定値`2`では最新2姿勢による等角速度外挿になります。
- `Catch-up Blend [ms]`: 新しいサンプルで外挿の基準が入れ替わったとき、スナップせずにこの時間で補正後の姿勢へブレンドします。`0`でブレンドを無効化し、既定値は`300` msです。

サンプルは検証・正規化して時刻順に保持されます。表示時刻を過去へ移動した場合や対象フィールドを変更した場合は、そのモデルの履歴をリセットします。終端が`now`の相対時間範囲は実時間に追従し、絶対時間範囲は指定された終端に固定されます。最新サンプル以後の外挿は無制限で、新しいサンプルが届くまで直近2姿勢の等角速度で回転し続けます。Catch-up Blendにより、その補正が姿勢の飛びとして現れないようにします。

### 8. Polyline（軌跡・ベクトル）オブジェクト
<img src="screenshots/menu8_polyline.png" alt="Polyline設定" width="250" />
- Points X/Y/Z に座標配列を割り当て、航跡や相対軌道を描画
- `Close Path` でループ、`Smooth Curve` でスプライン補間を適用

### 9. Annotation（注釈）オブジェクト
<img src="screenshots/menu9_anotation.png" alt="Annotation設定" width="250" />
- テキスト内容と位置をデータに紐づけ、イベント説明やラベルを表示
- ライン方向や文字色・サイズを調整して視認性を確保

## データ割り当てのポイント

- 各フィールドは `Const`（固定値）と `Field`（データソース列）を切り替えて使用できます
- データソースに複数の時系列がある場合は、Data Warehouse 側で X/Y/Z/Quat を揃えたテーブルを用意しておくと設定が容易です
- オブジェクトIDを `Target Object` に指定するとカメラの注視中心として利用できます

## ライセンス
GNU Lesser General Public License v3.0 の下で提供されています。

著作者: ISAS/JAXA and [NAKAHIRA, Satoshi](https://orcid.org/0000-0001-9307-046X), 尾崎めい (© 2025)。
